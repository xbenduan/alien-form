/**
 * @alien-form/core — Form engine
 * Value-capability runtime architecture
 */

import { signal, computed, effect, startBatch, endBatch } from "alien-signals";
import type {
  ArrayFieldNode,
  BaseFieldNode,
  DataSourceItem,
  FieldDisplayTypes,
  FieldError,
  FieldKind,
  FieldNode,
  FormConfig,
  FormError,
  FormInstance,
  IFieldSchema,
  IFormSchema,
  ObjectFieldNode,
  PrimitiveFieldNode,
  RowNode,
  RuntimeRuleContext,
  SchemaEffect,
  SchemaRuntimeValue,
  ValidateStatus,
  VoidFieldNode,
} from "./types";
import { evaluateExpression } from "./expression";
import { isEmptyValue, normalizeDataSource, normalizeValidationErrors, runStaticValidate } from "./validation";
import { getDeepValue, setDeepValue, sortByOrder } from "./path";
import { resolveSchemaTree } from "./ref-resolve";

interface FieldContext {
  readonly fieldsMap: Map<string, FieldNode>;
  readonly config: FormConfig;
  emitError(error: FormError): void;
  notifyFieldsChanged(): void;
  form: FormInstance;
}

type BuildOptions = {
  parent?: FieldNode;
  row?: RowNode;
  parentRequired?: boolean | string[];
};

let nextId = 0;
function createId(prefix: string): string {
  nextId += 1;
  return `${prefix}_${nextId}`;
}

function isPrimitiveField(field: FieldNode | undefined): field is PrimitiveFieldNode {
  return !!field && field.kind === "primitive";
}

function isArrayField(field: FieldNode | undefined): field is ArrayFieldNode {
  return !!field && field.kind === "array";
}

function isContainerField(field: FieldNode | undefined): field is ObjectFieldNode | VoidFieldNode {
  return !!field && (field.kind === "object" || field.kind === "void");
}

function shallowEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) if (!Object.is(a[k], b[k])) return false;
  return true;
}

function createBaseField(
  ctx: FieldContext,
  kind: FieldKind,
  path: string,
  schema: IFieldSchema,
  options: BuildOptions,
): BaseFieldNode {
  const base: BaseFieldNode = {
    id: createId(kind),
    path,
    schema,
    kind,
    parent: options.parent,
    row: options.row,
    display: signal<FieldDisplayTypes>(schema.display || "visible"),
    disabled: signal(schema.disabled === true),
    required: signal(schema.required === true || schema.validate?.required === true),
    errors: signal<FieldError[]>([]),
    warnings: signal<FieldError[]>([]),
    validateStatus: signal<ValidateStatus>(""),
    title: signal(schema.title || ""),
    description: signal(schema.description || ""),
    component: signal(schema.component || defaultComponentFor(kind)),
    componentProps: signal<Record<string, any>>(schema.props || {}),
    decorator: signal(schema.decorator || "FormItem"),
    decoratorProps: signal<Record<string, any>>(schema.decoratorProps || {}),
    dataSource: signal<DataSourceItem[]>(normalizeDataSource(schema.dataSource)),
    loading: signal(false),
    _disposers: [],
    dispose() {
      for (const d of base._disposers.splice(0)) d();
      if (isArrayField(base as FieldNode)) {
        for (const row of (base as ArrayFieldNode).rows()) disposeRow(row);
      } else if (isContainerField(base as FieldNode)) {
        for (const child of (base as ObjectFieldNode | VoidFieldNode).children.values()) child.dispose();
      }
      ctx.fieldsMap.delete(base.path);
    },
    setErrors(errors: FieldError[]) {
      base.errors(errors);
      base.validateStatus(errors.length > 0 ? "error" : "success");
    },
    setWarnings(warnings: FieldError[]) { base.warnings(warnings); },
    setDisplay(display: FieldDisplayTypes) { if (base.display() !== display) base.display(display); },
    setDisabled(value: boolean) { if (base.disabled() !== value) base.disabled(value); },
    setRequired(value: boolean) { if (base.required() !== value) base.required(value); },
    setLoading(loading: boolean) { if (base.loading() !== loading) base.loading(loading); },
    setDataSource(ds: DataSourceItem[]) {
      const normalized = normalizeDataSource(ds);
      if (!shallowEqual(base.dataSource(), normalized)) base.dataSource(normalized);
    },
    setComponent(component: string, props?: Record<string, any>) {
      if (base.component() !== component) base.component(component);
      if (props) base.componentProps({ ...base.componentProps(), ...props });
    },
    setDecorator(decorator: string, props?: Record<string, any>) {
      if (base.decorator() !== decorator) base.decorator(decorator);
      if (props) base.decoratorProps({ ...base.decoratorProps(), ...props });
    },
    async validate() {
      const value = projectNode(base as FieldNode);
      const staticErrors = runStaticValidate(schema.validate, value);
      if (base.required() && !schema.validate?.required && isEmptyValue(value)) {
        staticErrors.push({ message: "该字段为必填项", type: "required" });
      }
      let dynamicErrors: FieldError[] = [];
      if (schema["x-validate"]) {
        dynamicErrors = await runXValidate(ctx, base as FieldNode, schema["x-validate"]!, value);
      }
      const errors = [...staticErrors, ...dynamicErrors];
      base.setErrors(errors);
      return errors;
    },
    reset() {
      if (isPrimitiveField(base as FieldNode)) {
        const primitive = base as PrimitiveFieldNode;
        primitive.setValue(schema.default);
      } else if (isArrayField(base as FieldNode)) {
        (base as ArrayFieldNode).setRows(Array.isArray(schema.default) ? schema.default : []);
      }
      base.setErrors([]);
      base.setWarnings([]);
    },
  };
  return base;
}

function defaultComponentFor(kind: FieldKind): string {
  if (kind === "array") return "ArrayCards";
  if (kind === "object") return "SectionCard";
  return "Input";
}

function createPrimitiveField(ctx: FieldContext, path: string, schema: IFieldSchema, initialValue: any, options: BuildOptions): PrimitiveFieldNode {
  const base = createBaseField(ctx, "primitive", path, schema, options);
  const initial = initialValue !== undefined ? initialValue : schema.default;
  const field = base as PrimitiveFieldNode;
  const rowChildKey = options.row ? path.slice(options.row.path.length + 1).split(".")[0] : undefined;
  field.value = signal(initial);
  field.setValue = (value: any) => {
    if (options.row && rowChildKey && options.row.children.get(rowChildKey) !== field) {
      options.row.children.set(rowChildKey, field);
    }
    if (!Object.is(field.value(), value)) field.value(value);
  };
  ctx.fieldsMap.set(path, field);
  return field;
}

function createObjectField(ctx: FieldContext, path: string, schema: IFieldSchema, options: BuildOptions): ObjectFieldNode {
  const field = createBaseField(ctx, "object", path, schema, options) as ObjectFieldNode;
  field.children = new Map();
  ctx.fieldsMap.set(path, field);
  return field;
}

function createVoidField(ctx: FieldContext, path: string, schema: IFieldSchema, options: BuildOptions): VoidFieldNode {
  const field = createBaseField(ctx, "void", path, schema, options) as VoidFieldNode;
  field.children = new Map();
  ctx.fieldsMap.set(path, field);
  return field;
}

function createArrayField(ctx: FieldContext, path: string, schema: IFieldSchema, initialValue: any, options: BuildOptions): ArrayFieldNode {
  const field = createBaseField(ctx, "array", path, schema, options) as ArrayFieldNode;
  field.rows = signal<RowNode[]>([]);
  field.push = (iv?: any) => pushArrayRow(ctx, field, iv);
  field.remove = (index: number) => removeArrayRow(ctx, field, index);
  field.move = (from: number, to: number) => moveArrayRow(ctx, field, from, to);
  field.moveUp = (index: number) => moveArrayRow(ctx, field, index, index - 1);
  field.moveDown = (index: number) => moveArrayRow(ctx, field, index, index + 1);
  field.setRows = (values: any[]) => setArrayRows(ctx, field, Array.isArray(values) ? values : []);
  ctx.fieldsMap.set(path, field);
  field.setRows(Array.isArray(initialValue) ? initialValue : (Array.isArray(schema.default) ? schema.default : []));
  return field;
}

function buildFieldTree(
  ctx: FieldContext,
  path: string,
  rawSchema: IFieldSchema,
  initialValue?: any,
  options: BuildOptions = {},
): FieldNode {
  const definitions = (ctx.form as any)._definitions as Record<string, IFieldSchema>;
  const resolved = resolveSchemaTree(rawSchema, definitions, (_ref, msg) => {
    ctx.emitError({ scope: "ref-resolve", path, message: msg });
  });
  const key = path.split(".").pop() || path;
  const required = resolved.required === true || (Array.isArray(options.parentRequired) && options.parentRequired.includes(key));
  const schema = { ...resolved, required };
  const iv = initialValue !== undefined ? initialValue : getDeepValue((ctx.form as any)._initialValues, path);

  if (schema.type === "array" && schema.items && !Array.isArray(schema.items)) {
    return createArrayField(ctx, path, schema, iv, options);
  }

  if (schema.type === "object") {
    const field = createObjectField(ctx, path, schema, options);
    buildChildren(ctx, field, schema, iv, schema.required);
    return field;
  }

  if (schema.type === "void") {
    const field = createVoidField(ctx, path, schema, options);
    buildChildren(ctx, field, schema, undefined, schema.required);
    return field;
  }

  return createPrimitiveField(ctx, path, schema, iv, options);
}

function buildChildren(ctx: FieldContext, parent: ObjectFieldNode | VoidFieldNode, schema: IFieldSchema, initialValue: any, required?: boolean | string[]) {
  if (!schema.properties) return;
  for (const [childKey, childSchema] of sortByOrder(schema.properties)) {
    const childContainerPath = parent.kind === "void"
      ? (parent.path.includes(".") ? parent.path.slice(0, parent.path.lastIndexOf(".")) : "")
      : parent.path;
    const childPath = childContainerPath ? `${childContainerPath}.${childKey}` : childKey;
    const childIv = initialValue != null ? initialValue[childKey] : getDeepValue((ctx.form as any)._initialValues, childPath);
    const child = buildFieldTree(ctx, childPath, childSchema, childIv, { parent, row: parent.row, parentRequired: required });
    parent.children.set(childKey, child);
  }
}

function createRow(ctx: FieldContext, array: ArrayFieldNode, index: number, initialValues?: any): RowNode {
  const row: RowNode = {
    id: createId("row"),
    index,
    path: `${array.path}.${index}`,
    parent: array,
    children: new Map(),
  };
  const itemSchema = array.schema.items as IFieldSchema;
  if (itemSchema.properties) {
    for (const [childKey, childSchema] of sortByOrder(itemSchema.properties)) {
      const childPath = `${row.path}.${childKey}`;
      const child = buildFieldTree(ctx, childPath, childSchema, initialValues?.[childKey], { parent: array, row, parentRequired: itemSchema.required });
      row.children.set(childKey, child);
    }
  }
  installRowRuntime(ctx, row);
  return row;
}

function disposeRow(row: RowNode) {
  for (const child of row.children.values()) child.dispose();
  row.children.clear();
}

function pushArrayRow(ctx: FieldContext, array: ArrayFieldNode, initialValues?: any) {
  startBatch();
  const rows = array.rows().slice();
  rows.push(createRow(ctx, array, rows.length, initialValues));
  array.rows(rows);
  ctx.notifyFieldsChanged();
  endBatch();
}

function removeArrayRow(ctx: FieldContext, array: ArrayFieldNode, index: number) {
  const rows = array.rows().slice();
  if (index < 0 || index >= rows.length) return;
  startBatch();
  const [removed] = rows.splice(index, 1);
  disposeRow(removed);
  reindexRows(ctx, array, rows);
  array.rows(rows);
  ctx.notifyFieldsChanged();
  endBatch();
}

function moveArrayRow(ctx: FieldContext, array: ArrayFieldNode, from: number, to: number) {
  const rows = array.rows().slice();
  if (from < 0 || from >= rows.length || to < 0 || to >= rows.length || from === to) return;
  startBatch();
  const [row] = rows.splice(from, 1);
  rows.splice(to, 0, row);
  reindexRows(ctx, array, rows);
  array.rows(rows);
  ctx.notifyFieldsChanged();
  endBatch();
}

function setArrayRows(ctx: FieldContext, array: ArrayFieldNode, values: any[]) {
  startBatch();
  for (const row of array.rows()) disposeRow(row);
  const rows = values.map((value, index) => createRow(ctx, array, index, value));
  array.rows(rows);
  ctx.notifyFieldsChanged();
  endBatch();
}

function reindexRows(ctx: FieldContext, array: ArrayFieldNode, rows: RowNode[]) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    row.index = i;
    row.path = `${array.path}.${i}`;
    updateChildPaths(ctx, row.children, row.path);
  }
}

function updateChildPaths(ctx: FieldContext, children: Map<string, FieldNode>, parentPath: string) {
  for (const [key, child] of children) {
    ctx.fieldsMap.delete(child.path);
    child.path = `${parentPath}.${key}`;
    ctx.fieldsMap.set(child.path, child);
    if (isContainerField(child)) updateChildPaths(ctx, child.children, child.path);
    if (isArrayField(child)) reindexRows(ctx, child, child.rows());
  }
}

function installRowRuntime(ctx: FieldContext, row: RowNode) {
  for (const child of row.children.values()) installFieldRuntime(ctx, child);
}

function installFieldRuntime(ctx: FieldContext, field: FieldNode) {
  if (field.schema["x-reaction"]) installReactions(ctx, field);
  if (field.schema["x-effect"]) installEffects(ctx, field, field.schema["x-effect"]);
  if (isContainerField(field)) for (const child of field.children.values()) installFieldRuntime(ctx, child);
  if (isArrayField(field)) for (const row of field.rows()) installRowRuntime(ctx, row);
}

function projectFormValues(root: ObjectFieldNode): Record<string, any> {
  return projectChildren(root.children) || {};
}

function projectNode(node: FieldNode): any {
  if (node.display() === "none") return undefined;
  if (isPrimitiveField(node)) return node.value();
  if (node.kind === "object") return projectChildren(node.children);
  if (node.kind === "array") return node.rows().map((row) => projectChildren(row.children) || {});
  if (node.kind === "void") return projectChildren(node.children);
  return undefined;
}

function projectChildren(children: Map<string, FieldNode>): Record<string, any> | undefined {
  const result: Record<string, any> = {};
  for (const [key, child] of children) {
    const value = projectNode(child);
    if (value === undefined) continue;
    if (child.kind === "void" && value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, value);
      continue;
    }
    result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function resolveSelector(ctx: FieldContext, baseField: FieldNode, selector: string): any {
  if (!selector) return undefined;
  if (selector === "$value") return isPrimitiveField(baseField) ? baseField.value() : projectNode(baseField);
  if (selector === "$path") return baseField.path;
  if (selector.startsWith("$row.")) {
    const key = selector.slice(5);
    const row = baseField.row;
    const field = row?.children.get(key);
    return selectorValue(field);
  }
  const collectionMatch = selector.match(/^(.*)\[\]\.(.+)$/);
  if (collectionMatch) {
    const array = ctx.fieldsMap.get(collectionMatch[1]);
    const childPath = collectionMatch[2];
    if (!isArrayField(array)) return [];
    return array.rows().map((row) => selectorValue(resolveRowChild(row, childPath)));
  }
  const absolute = resolveRelativeSelector(baseField, selector);
  return selectorValue(ctx.fieldsMap.get(absolute));
}

function resolveRowChild(row: RowNode, childPath: string): FieldNode | undefined {
  const [first, ...rest] = childPath.split(".");
  let node = row.children.get(first);
  for (const segment of rest) {
    if (isContainerField(node)) node = node.children.get(segment);
    else if (isArrayField(node) && /^\d+$/.test(segment)) {
      const next = node.rows()[Number(segment)];
      node = next ? undefined : undefined;
    } else return undefined;
  }
  return node;
}

function resolveRelativeSelector(baseField: FieldNode, selector: string): string {
  if (selector.startsWith("./")) {
    const base = baseField.path.includes(".") ? baseField.path.slice(0, baseField.path.lastIndexOf(".")) : "";
    return base ? `${base}.${selector.slice(2)}` : selector.slice(2);
  }
  return selector;
}

function selectorValue(field: FieldNode | undefined): any {
  if (!field) return undefined;
  if (isPrimitiveField(field)) return field.value();
  if (field.kind === "array" || field.kind === "object") return { kind: field.kind, path: field.path };
  return undefined;
}

function buildRuntimeContext(ctx: FieldContext, field: FieldNode, kind: RuntimeRuleContext["kind"], key?: string, value?: any): RuntimeRuleContext {
  const runtime: RuntimeRuleContext = {
    field,
    form: ctx.form,
    path: field.path,
    key,
    kind,
    schema: field.schema,
    row: field.row,
    scope: ctx.config.scope || {},
    get values() { return ctx.form.values(); },
    value,
    get(selector: string) { return resolveSelector(ctx, field, selector); },
    set(selector: string, next: any) { setSelectorValue(ctx, field, selector, next); },
    project(selector?: string) {
      if (!selector) return projectNode(field);
      const resolved = resolveRelativeSelector(field, selector);
      const target = ctx.fieldsMap.get(resolved);
      return target ? projectNode(target) : undefined;
    },
    effect(runner: () => void | (() => void)) { return effect(runner); },
  };
  return runtime;
}

function setSelectorValue(ctx: FieldContext, baseField: FieldNode, selector: string, value: any) {
  const resolved = selector.startsWith("$row.") && baseField.row
    ? `${baseField.row.path}.${selector.slice(5)}`
    : resolveRelativeSelector(baseField, selector);
  const field = ctx.fieldsMap.get(resolved);
  if (isPrimitiveField(field)) field.setValue(value);
  else warnInvalid(ctx, field || baseField, "set", `Cannot set non-primitive selector "${selector}".`);
}

function installReactions(ctx: FieldContext, field: FieldNode) {
  const reactions = field.schema["x-reaction"]!;
  for (const [key, raw] of Object.entries(reactions)) {
    const rules = Array.isArray(raw) ? raw : [raw];
    for (const rule of rules) {
      const dispose = effect(() => {
        const runtime = buildRuntimeContext(ctx, field, "x-reaction", key);
        const result = executeRuntimeValue(ctx, field, rule, runtime, key);
        if (isPromiseLike(result)) {
          let alive = true;
          const cancel = () => { alive = false; };
          field._disposers.push(cancel);
          result.then((value: any) => {
            if (alive) applyReactionValue(ctx, field, key, value);
          })
            .catch((err: any) => {
              ctx.emitError({ scope: "x-reaction", path: field.path, key, message: errorMessage(err), cause: err });
            });
        } else {
          applyReactionValue(ctx, field, key, result);
        }
      });
      field._disposers.push(dispose);
    }
  }
}

function installEffects(ctx: FieldContext, field: FieldNode, raw: SchemaEffect) {
  const rules = Array.isArray(raw) ? raw : [raw];
  for (const rule of rules) {
    const runtime = buildRuntimeContext(ctx, field, "x-effect");
    try {
      const result = executeRuntimeValue(ctx, field, rule, runtime, "x-effect");
      if (typeof result === "function") field._disposers.push(result);
      else if (isPromiseLike(result)) result.then((dispose: any) => { if (typeof dispose === "function") field._disposers.push(dispose); })
        .catch((err: any) => ctx.emitError({ scope: "x-effect", path: field.path, message: errorMessage(err), cause: err }));
    } catch (err) {
      ctx.emitError({ scope: "x-effect", path: field.path, message: errorMessage(err), cause: err });
    }
  }
}

function executeRuntimeValue(ctx: FieldContext, field: FieldNode, rule: SchemaRuntimeValue, runtime: RuntimeRuleContext, key?: string): any {
  try {
    if (typeof rule === "function") return rule(runtime, ctx.form);
    if (typeof rule === "string") {
      if (isExpression(rule)) return evaluateExpression(extractExpression(rule), buildExpressionScope(ctx, field, runtime));
      if (rule.startsWith("@")) {
        const name = rule.slice(1);
        const handler = ctx.config.handlers?.[name];
        if (!handler) {
          ctx.emitError({ scope: runtime.kind, path: field.path, key, message: `Handler "${name}" not found.` });
          return undefined;
        }
        return handler(runtime, ctx.form);
      }
    }
    return rule;
  } catch (err) {
    ctx.emitError({ scope: runtime.kind === "x-effect" ? "x-effect" : "x-reaction", path: field.path, key, message: errorMessage(err), cause: err });
    return undefined;
  }
}

function isExpression(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("{{") && trimmed.endsWith("}}");
}

function extractExpression(value: string): string {
  return value.trim().slice(2, -2).trim();
}

function buildExpressionScope(ctx: FieldContext, field: FieldNode, runtime: RuntimeRuleContext): Record<string, any> {
  const values = ctx.form.values();
  const scope: Record<string, any> = {
    ...values,
    ...(ctx.config.scope || {}),
    $self: field,
    $form: ctx.form,
    $values: values,
    $row: field.row ? projectChildren(field.row.children) || {} : undefined,
    $path: field.path,
    $get: (selector: string) => runtime.get(selector),
    $project: (selector?: string) => runtime.project(selector),
  };
  if (field.row) Object.assign(scope, projectChildren(field.row.children) || {});
  if (field.parent && isContainerField(field.parent)) Object.assign(scope, projectChildren(field.parent.children) || {});
  return scope;
}

function applyReactionValue(ctx: FieldContext, field: FieldNode, key: string, value: any) {
  if (value === undefined) return;
  switch (key) {
    case "value":
      if (isPrimitiveField(field)) {
        const current = field.value();
        if (!Object.is(current, value) && !shallowEqual(current, value)) field.setValue(value);
      } else warnInvalid(ctx, field, key, `x-reaction.value is only valid for primitive fields.`);
      break;
    case "rows":
      if (isArrayField(field)) field.setRows(Array.isArray(value) ? value : []);
      else warnInvalid(ctx, field, key, `x-reaction.rows is only valid for array fields.`);
      break;
    case "display": field.setDisplay(value as FieldDisplayTypes); break;
    case "disabled": field.setDisabled(Boolean(value)); break;
    case "required": field.setRequired(Boolean(value)); break;
    case "title": if (field.title() !== value) field.title(String(value)); break;
    case "description": if (field.description() !== value) field.description(String(value)); break;
    case "props": {
      const merged = { ...field.componentProps(), ...value };
      if (!shallowEqual(field.componentProps(), merged)) field.componentProps(merged);
      break;
    }
    case "decoratorProps": {
      const merged = { ...field.decoratorProps(), ...value };
      if (!shallowEqual(field.decoratorProps(), merged)) field.decoratorProps(merged);
      break;
    }
    case "component": Array.isArray(value) ? field.setComponent(value[0], value[1]) : field.setComponent(value); break;
    case "decorator": Array.isArray(value) ? field.setDecorator(value[0], value[1]) : field.setDecorator(value); break;
    case "dataSource": field.setDataSource(value); break;
    default:
      warnInvalid(ctx, field, key, `Unknown x-reaction target "${key}".`);
  }
}

async function runXValidate(ctx: FieldContext, field: FieldNode, raw: SchemaRuntimeValue | SchemaRuntimeValue[], value: any): Promise<FieldError[]> {
  const rules = Array.isArray(raw) ? raw : [raw];
  const errors: FieldError[] = [];
  for (const rule of rules) {
    const runtime = buildRuntimeContext(ctx, field, "x-validate", "validate", value);
    const result = await executeRuntimeValue(ctx, field, rule, runtime, "validate");
    errors.push(...normalizeValidationErrors(result));
  }
  return errors;
}

function warnInvalid(ctx: FieldContext, field: FieldNode, key: string, message: string) {
  if (typeof console !== "undefined" && console.warn) console.warn(`[alien-form] ${message} path=${field.path}`);
  ctx.emitError({ scope: "x-reaction", path: field.path, key, message });
}

function isPromiseLike(value: any): value is Promise<any> {
  return value && typeof value === "object" && typeof value.then === "function";
}

function errorMessage(err: any): string {
  return err instanceof Error ? err.message : String(err);
}

export function createForm(config: FormConfig = {}): FormInstance {
  const errorListeners = new Set<(e: FormError) => void>(config.onError ? [config.onError] : []);
  const fieldsMap = new Map<string, FieldNode>();
  const fieldsSignal = signal(fieldsMap);
  let destroyed = false;
  const effectDisposers = new Set<() => void>();
  const initialValues = config.initialValues ? { ...config.initialValues } : {};
  const schema: IFormSchema = config.schema || { type: "object", properties: {} };
  const definitions: Record<string, IFieldSchema> = schema.definitions || {};
  const form: FormInstance = {} as FormInstance;
  const ctx: FieldContext = {
    fieldsMap,
    config,
    emitError(error) { for (const listener of errorListeners) listener(error); },
    notifyFieldsChanged() { fieldsSignal(fieldsMap); },
    form,
  };
  (form as any)._definitions = definitions;
  (form as any)._initialValues = initialValues;

  const root = createObjectField(ctx, "", { ...schema, type: "object" }, { parentRequired: schema.required });
  buildChildren(ctx, root, schema, initialValues, schema.required);

  const submittingSignal = signal(false);
  const valuesComputed = computed(() => projectFormValues(root));
  const errorsComputed = computed(() => {
    const all: FieldError[] = [];
    for (const field of fieldsSignal().values()) if (field.display() !== "none") all.push(...field.errors());
    return all;
  });
  const validComputed = computed(() => errorsComputed().length === 0);

  Object.assign(form, {
    schema,
    root,
    fields: fieldsSignal,
    submitting: submittingSignal,
    values: valuesComputed,
    errors: errorsComputed,
    valid: validComputed,
    field(path: string) { return fieldsSignal().get(path); },
    get(selector: string) { return resolveSelector(ctx, root, selector); },
    set(selector: string, value: any) { setSelectorValue(ctx, root, selector, value); },
    project(selector?: string) {
      if (!selector) return projectFormValues(root);
      const field = fieldsSignal().get(selector);
      return field ? projectNode(field) : undefined;
    },
    setValues(values: Record<string, any>) {
      if (!values || typeof values !== "object") return;
      startBatch();
      for (const [path, field] of fieldsSignal()) {
        if (path === "") continue;
        const value = getDeepValue(values, path);
        if (value === undefined) continue;
        if (isPrimitiveField(field)) field.setValue(value);
        else if (isArrayField(field) && Array.isArray(value)) field.setRows(value);
      }
      endBatch();
    },
    setInitialValues(values: Record<string, any>) { (form as any)._initialValues = { ...values }; },
    reset() { startBatch(); root.reset(); for (const child of root.children.values()) child.reset(); endBatch(); },
    async validate() {
      const results = await Promise.all(Array.from(fieldsSignal().values()).filter((f: FieldNode) => f.display() !== "none").map((f: FieldNode) => f.validate()));
      return results.every((errors) => errors.length === 0);
    },
    async submit<T = any>(onSubmit?: (values: Record<string, any>) => T | Promise<T>) {
      submittingSignal(true);
      try {
        const isValid = await form.validate();
        if (!isValid) {
          const error: any = new Error("Validation failed");
          error.messages = form.errors().map((e: FieldError) => e.message);
          throw error;
        }
        return onSubmit ? await onSubmit(form.values()) : (form.values() as T);
      } finally { submittingSignal(false); }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      root.dispose();
      for (const d of effectDisposers) d();
      effectDisposers.clear();
      errorListeners.clear();
    },
    onError(listener: (error: FormError) => void) {
      errorListeners.add(listener);
      return () => { errorListeners.delete(listener); };
    },
    effect<T>(runnerOrSelector: ((form: FormInstance) => void | (() => void)) | ((form: FormInstance) => T), listener?: (value: T, prev: T | undefined) => void, options?: { immediate?: boolean; equals?: (a: T, b: T) => boolean }) {
      if (!listener) {
        const dispose = effect(() => { if (!destroyed) return (runnerOrSelector as (form: FormInstance) => void | (() => void))(form); });
        effectDisposers.add(dispose);
        return () => { dispose(); effectDisposers.delete(dispose); };
      }
      const equals = options?.equals ?? Object.is;
      let initialized = false;
      let prev: T | undefined;
      const dispose = effect(() => {
        if (destroyed) return;
        const next = (runnerOrSelector as (form: FormInstance) => T)(form);
        if (!initialized) {
          initialized = true;
          if (options?.immediate) listener(next, prev);
          prev = next;
          return;
        }
        if (equals(prev as T, next)) return;
        const old = prev;
        prev = next;
        listener(next, old);
      });
      effectDisposers.add(dispose);
      return () => { dispose(); effectDisposers.delete(dispose); };
    },
  } as FormInstance);

  startBatch();
  installFieldRuntime(ctx, root);
  if (schema["x-effect"]) installEffects(ctx, root, schema["x-effect"]);
  if (schema["x-reaction"]) installReactions(ctx, root);
  endBatch();

  return form;
}

export { sortByOrder, setDeepValue, getDeepValue };
