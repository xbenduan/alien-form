/**
 * @alien-form/core — Form engine
 * Value-capability runtime architecture
 */

import {
  signal,
  computed,
  effect,
  startBatch,
  endBatch,
  getActiveSub,
  setActiveSub,
} from "alien-signals";
import { validateValueConstraints } from "@alien-form/protocol";
import type {
  ArrayFieldNode,
  BaseFieldNode,
  DataSourceItem,
  ExpressionScope,
  FieldDisplayTypes,
  FieldError,
  FieldKind,
  FieldNode,
  FormConfig,
  FormError,
  FormInstance,
  IFieldSchema,
  IFormSchema,
  NamePath,
  ObjectFieldNode,
  PrimitiveFieldNode,
  RowNode,
  RuntimeRuleContext,
  SchemaEffect,
  SchemaRuntimeValue,
  SchemaXValidateRule,
  ValidateStatus,
  VoidFieldNode,
} from "./types";
import { compileExpr } from "./expression";
import { InstanceStore } from "./instance-store";
import { PathResolver } from "./path-resolver";
import { compileSchemaGraph, type SchemaGraph, type SchemaNode } from "./schema-graph";
import { normalizeDataSource, normalizeValidationErrors } from "./validation";
import { getDeepValue, normalizeNamePath, setDeepValue, sortByOrder } from "./path";

interface FieldContext {
  readonly graph: SchemaGraph;
  readonly store: InstanceStore;
  readonly resolver: PathResolver;
  readonly mountedFields: Set<FieldNode>;
  readonly config: FormConfig;
  initialValues: Record<string, any>;
  emitError(error: FormError): void;
  isMounted(): boolean;
  form: FormInstance;
}

type BuildOptions = {
  parent?: FieldNode;
  row?: RowNode;
  containerValue?: any;
};

type ProjectionMode = "data" | "output";

let nextId = 0;

/** Runs reactive mutations in an exception-safe batch. */
function batch<T>(run: () => T): T {
  startBatch();
  try {
    return run();
  } finally {
    endBatch();
  }
}

/** Runs every disposer even when another disposer or error listener throws. */
function runDisposers(disposers: Iterable<() => void>, report: (cause: unknown) => void) {
  for (const dispose of disposers) {
    try {
      dispose();
    } catch (cause) {
      try {
        report(cause);
      } catch {
        // Cleanup must continue even when user-provided error handling fails.
      }
    }
  }
}

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

/**
 * 字段是否参与校验:仅当它对用户「可编辑且可见」时才校验。
 * display 为 none / hidden(不呈现输入)或 disabled(不可编辑)的字段一律豁免 ——
 * 这些字段的取值不由用户填写(如自动生成的 id、只读时间戳),不应触发必填等校验。
 */
function isValidatable(field: FieldNode): boolean {
  const display = field.display();
  return display !== "none" && display !== "hidden" && !field.disabled();
}

/**
 * 叶子写入守卫：接受标量、后端展开的原子引用，以及无 items 的标量数组。
 * 具有 properties / items 的复杂结构仍必须通过对应容器字段维护。
 */
function isReferenceValue(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).$ref === "string" &&
    "value" in value
  );
}

function assertPrimitiveValue(value: any, path: string, schema: IFieldSchema): void {
  if (value == null) return; // null/undefined 视为清空,放行
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return;
  if (isReferenceValue(value)) return;
  if (
    schema.type === "array" &&
    !schema.items &&
    Array.isArray(value) &&
    value.every(
      (item) =>
        item == null ||
        ["string", "number", "boolean"].includes(typeof item) ||
        isReferenceValue(item),
    )
  ) {
    return;
  }
  throw new TypeError(
    `字段 "${path}" 的值只接受标量、引用值或无 items 的标量数组,收到 ${Array.isArray(value) ? "array" : t}。`,
  );
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

/** Executes a read without attaching it to the currently active reactive subscriber. */
function untracked<T>(read: () => T): T {
  const active = getActiveSub();
  setActiveSub();
  try {
    return read();
  } finally {
    setActiveSub(active);
  }
}

/** Creates an isolated deeply frozen snapshot for the public form.data boundary. */
function immutableSnapshot<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (!value || typeof value !== "object") return value;
  const cached = seen.get(value);
  if (cached) return cached as T;
  if (value instanceof Date) return Object.freeze(new Date(value.getTime())) as T;

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const item of value) copy.push(immutableSnapshot(item, seen));
    return Object.freeze(copy) as T;
  }

  const copy: Record<string, unknown> = {};
  seen.set(value, copy);
  for (const [key, item] of Object.entries(value)) {
    copy[key] = immutableSnapshot(item, seen);
  }
  return Object.freeze(copy) as T;
}

/** Invalidates pending validation for a field and its projected containers. */
function invalidateValidation(ctx: FieldContext, field: FieldNode): void {
  let current: FieldNode | undefined = field;
  while (current) {
    ctx.store.bumpValidation(current);
    if (current.validateStatus() === "validating") current.validateStatus("");
    current = current.parent;
  }
}

function createBaseField(
  ctx: FieldContext,
  node: SchemaNode,
  options: BuildOptions,
): BaseFieldNode {
  const { kind, schema } = node;
  const base: BaseFieldNode = {
    id: createId(kind),
    get path() {
      return ctx.resolver.fieldPath(base as FieldNode);
    },
    schema,
    kind,
    parent: options.parent,
    row: options.row,
    display: signal<FieldDisplayTypes>(schema.display || "visible"),
    disabled: signal(schema.disabled === true),
    required: signal(node.required),
    errors: signal<FieldError[]>([]),
    warnings: signal<FieldError[]>([]),
    validateStatus: signal<ValidateStatus>(""),
    title: signal(schema.title || undefined),
    description: signal(schema.description || ""),
    component: signal(schema.component || defaultComponentFor(kind)),
    componentProps: signal<Record<string, any>>(schema.props || {}),
    decorator: signal(schema.decorator || "FormItem"),
    decoratorProps: signal<Record<string, any>>(schema.decoratorProps || {}),
    dataSource: signal<DataSourceItem[]>(
      normalizeDataSource(Array.isArray(schema.dataSource) ? schema.dataSource : []),
    ),
    loading: signal(false),
    _disposers: [],
    dispose() {
      invalidateValidation(ctx, base as FieldNode);
      stopFieldRuntime(ctx, base as FieldNode);
      if (isArrayField(base as FieldNode)) {
        for (const row of (base as ArrayFieldNode).rows()) disposeRow(ctx, row);
        ctx.store.clearArray(base as ArrayFieldNode);
      } else if (isContainerField(base as FieldNode)) {
        for (const child of (base as ObjectFieldNode | VoidFieldNode).children.values())
          child.dispose();
        ctx.store.clearChildren(base as ObjectFieldNode | VoidFieldNode);
      }
      ctx.store.unregisterField(base as FieldNode);
      ctx.mountedFields.delete(base as FieldNode);
    },
    setErrors(errors: FieldError[]) {
      base.errors(errors);
      base.validateStatus(errors.length > 0 ? "error" : "success");
    },
    setWarnings(warnings: FieldError[]) {
      base.warnings(warnings);
    },
    setDisplay(display: FieldDisplayTypes) {
      if (base.display() !== display) base.display(display);
    },
    setDisabled(value: boolean) {
      if (base.disabled() !== value) base.disabled(value);
    },
    setRequired(value: boolean) {
      if (base.required() !== value) base.required(value);
    },
    setLoading(loading: boolean) {
      base.loading(loading);
    },
    setDataSource(ds: DataSourceItem[]) {
      base.dataSource(normalizeDataSource(ds));
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
      const field = base as FieldNode;
      const version = ctx.store.bumpValidation(field);
      base.validateStatus("validating");
      const value = projectNode(ctx, base as FieldNode, "output");
      const errors: FieldError[] = validateValueConstraints(schema, value, {
        required: base.required(),
        label: schema.title ?? base.path,
      });
      if (schema["x-validate"]) {
        errors.push(...(await runXValidate(ctx, base as FieldNode, schema["x-validate"]!, value)));
      }
      if (!ctx.store.has(field) || ctx.store.validationGeneration(field) !== version) return [];
      base.setErrors(errors);
      return errors;
    },
    reset() {
      if (isPrimitiveField(base as FieldNode)) {
        const primitive = base as PrimitiveFieldNode;
        primitive.setValue(schema.default);
      } else if (isArrayField(base as FieldNode)) {
        (base as ArrayFieldNode).setRows(Array.isArray(schema.default) ? schema.default : []);
      } else if (isContainerField(base as FieldNode)) {
        // object / void 容器递归重置子节点，否则深层嵌套字段不会被还原
        for (const child of (base as ObjectFieldNode | VoidFieldNode).children.values())
          child.reset();
      }
      base.setErrors([]);
      base.setWarnings([]);
    },
  };
  ctx.store.registerField(
    base as FieldNode,
    node,
    ctx.store.rowAncestry(options.parent, options.row),
  );
  return base;
}

function defaultComponentFor(kind: FieldKind): string {
  if (kind === "array" || kind === "object") return "Card";
  return "Input";
}

function createPrimitiveField(
  ctx: FieldContext,
  node: SchemaNode,
  initialValue: any,
  options: BuildOptions,
): PrimitiveFieldNode {
  const schema = node.schema;
  const base = createBaseField(ctx, node, options);
  const field = base as PrimitiveFieldNode;
  const initial = initialValue !== undefined ? initialValue : schema.default;
  const formattedInitial = formatFieldValue(ctx, field, "input", initial);
  field.value = signal(formattedInitial);
  field.setValue = (value: any) => {
    assertPrimitiveValue(value, field.path, schema);
    if (!Object.is(field.value(), value)) {
      invalidateValidation(ctx, field);
      field.value(value);
    }
  };
  return field;
}

function createObjectField(
  ctx: FieldContext,
  node: SchemaNode,
  options: BuildOptions,
): ObjectFieldNode {
  const field = createBaseField(ctx, node, options) as ObjectFieldNode;
  Object.defineProperty(field, "children", {
    enumerable: true,
    get: () => ctx.store.children(field),
  });
  return field;
}

function createVoidField(
  ctx: FieldContext,
  node: SchemaNode,
  options: BuildOptions,
): VoidFieldNode {
  const field = createBaseField(ctx, node, options) as VoidFieldNode;
  Object.defineProperty(field, "children", {
    enumerable: true,
    get: () => ctx.store.children(field),
  });
  return field;
}

function createArrayField(
  ctx: FieldContext,
  node: SchemaNode,
  initialValue: any,
  options: BuildOptions,
): ArrayFieldNode {
  const schema = node.schema;
  const field = createBaseField(ctx, node, options) as ArrayFieldNode;
  const state = ctx.store.createArray(field);
  field.rows = computed(() => ctx.store.rows(field));
  field.push = (iv?: any) => pushArrayRow(ctx, field, iv);
  field.remove = (index: number) => removeArrayRow(ctx, field, index);
  field.move = (from: number, to: number) => moveArrayRow(ctx, field, from, to);
  field.moveUp = (index: number) => moveArrayRow(ctx, field, index, index - 1);
  field.moveDown = (index: number) => moveArrayRow(ctx, field, index, index + 1);
  field.setRows = (values: any[]) => setArrayRows(ctx, field, Array.isArray(values) ? values : []);
  const initialRows = Array.isArray(initialValue)
    ? initialValue
    : Array.isArray(schema.default)
      ? schema.default
      : [];
  const formattedRows = formatFieldValue(ctx, field, "input", initialRows);
  const rows = (Array.isArray(formattedRows) ? formattedRows : []).map((value, index) =>
    createRow(ctx, field, index, value),
  );
  state.rowIds(rows.map((row) => row.id));
  return field;
}

function buildFieldTree(
  ctx: FieldContext,
  node: SchemaNode,
  initialValue?: any,
  options: BuildOptions = {},
): FieldNode {
  const iv = initialValue;

  // void 节点不占数据路径，子字段路径和值扁平上浮到父级。
  if (node.kind === "void") {
    const field = createVoidField(ctx, node, options);
    buildChildren(ctx, field, node, options.containerValue);
    return field;
  }

  if (node.kind === "array") {
    return createArrayField(ctx, node, iv, options);
  }

  if (node.kind === "object") {
    const field = createObjectField(ctx, node, options);
    const formattedInput = formatFieldValue(ctx, field, "input", iv);
    buildChildren(ctx, field, node, formattedInput);
    return field;
  }

  return createPrimitiveField(ctx, node, iv, options);
}

function buildChildren(
  ctx: FieldContext,
  parent: ObjectFieldNode | VoidFieldNode,
  node: SchemaNode,
  initialValue: any,
) {
  for (const [childKey, childNode] of node.children) {
    const childIv = initialValue != null ? initialValue[childKey] : undefined;
    const child = buildFieldTree(ctx, childNode, childIv, {
      parent,
      row: parent.row,
      containerValue: initialValue,
    });
    ctx.store.setChild(parent, childKey, child);
  }
}

function createRow(
  ctx: FieldContext,
  array: ArrayFieldNode,
  index: number,
  initialValues?: any,
): RowNode {
  const row = {
    id: createId("row"),
    get index() {
      return ctx.store.rowIndex(row);
    },
    get path() {
      return ctx.resolver.rowPath(row);
    },
    parent: array,
    get children() {
      return ctx.store.children(row);
    },
  } as RowNode;
  ctx.store.registerRow(row, index);
  const item = ctx.store.schema(array).item;
  if (item) {
    for (const [childKey, childNode] of item.children) {
      const child = buildFieldTree(ctx, childNode, initialValues?.[childKey], {
        parent: array,
        row,
        containerValue: initialValues,
      });
      ctx.store.setChild(row, childKey, child);
    }
  }
  return row;
}

function disposeRow(ctx: FieldContext, row: RowNode) {
  for (const child of row.children.values()) child.dispose();
  ctx.store.clearChildren(row);
  ctx.store.unregisterRow(row);
}

function pushArrayRow(ctx: FieldContext, array: ArrayFieldNode, initialValues?: any) {
  batch(() => {
    const state = ctx.store.array(array);
    const row = createRow(ctx, array, state.rowIds().length, initialValues);
    invalidateValidation(ctx, array);
    state.rowIds([...state.rowIds(), row.id]);
    if (ctx.isMounted()) installRowRuntime(ctx, row);
  });
}

function removeArrayRow(ctx: FieldContext, array: ArrayFieldNode, index: number) {
  const state = ctx.store.array(array);
  const rowIds = state.rowIds().slice();
  if (index < 0 || index >= rowIds.length) return;
  batch(() => {
    const [removedId] = rowIds.splice(index, 1);
    const removed = state.rows.get(removedId);
    invalidateValidation(ctx, array);
    state.rowIds(rowIds);
    if (removed) disposeRow(ctx, removed);
  });
}

function moveArrayRow(ctx: FieldContext, array: ArrayFieldNode, from: number, to: number) {
  const state = ctx.store.array(array);
  const rowIds = state.rowIds().slice();
  if (from < 0 || from >= rowIds.length || to < 0 || to >= rowIds.length || from === to) return;
  batch(() => {
    const [rowId] = rowIds.splice(from, 1);
    rowIds.splice(to, 0, rowId);
    invalidateValidation(ctx, array);
    state.rowIds(rowIds);
  });
}

function setArrayRows(ctx: FieldContext, array: ArrayFieldNode, values: any[]) {
  batch(() => {
    const state = ctx.store.array(array);
    invalidateValidation(ctx, array);
    for (const row of state.rows.values()) disposeRow(ctx, row);
    const rows = values.map((value, index) => createRow(ctx, array, index, value));
    state.rowIds(rows.map((row) => row.id));
    if (ctx.isMounted()) for (const row of rows) installRowRuntime(ctx, row);
  });
}

/** Projects the current instance graph to a path index on demand. */
function collectFields(root: FieldNode): Map<string, FieldNode> {
  const fields = new Map<string, FieldNode>();
  visitFields(root, (field) => {
    fields.set(field.path, field);
  });
  return fields;
}

/** Visits live field instances without deriving their positional paths. */
function visitFields(root: FieldNode, visit: (field: FieldNode) => void): void {
  visit(root);
  if (isContainerField(root)) {
    for (const child of root.children.values()) visitFields(child, visit);
  } else if (isArrayField(root)) {
    for (const row of root.rows()) {
      for (const child of row.children.values()) visitFields(child, visit);
    }
  }
}

/** Returns all currently reachable field instances. */
function listFields(root: FieldNode): FieldNode[] {
  const fields: FieldNode[] = [];
  visitFields(root, (field) => fields.push(field));
  return fields;
}

function installRowRuntime(ctx: FieldContext, row: RowNode) {
  for (const child of row.children.values()) installFieldRuntime(ctx, child);
}

function installFieldRuntime(ctx: FieldContext, field: FieldNode) {
  if (!ctx.store.installRuntime(field)) return;
  if (field.schema.dataSource !== undefined && !Array.isArray(field.schema.dataSource)) {
    installDataSource(ctx, field, field.schema.dataSource);
  }
  if (field.schema["x-reaction"]) installReactions(ctx, field);
  if (field.schema["x-effect"]) installEffects(ctx, field, field.schema["x-effect"]);
  if (isContainerField(field))
    for (const child of field.children.values()) installFieldRuntime(ctx, child);
  if (isArrayField(field)) for (const row of field.rows()) installRowRuntime(ctx, row);
}

/** Stops one field's runtime resources and makes it mountable again. */
function stopFieldRuntime(ctx: FieldContext, field: FieldNode) {
  runDisposers(field._disposers.splice(0), (cause) =>
    ctx.emitError({
      scope: "x-effect",
      path: field.path,
      message: errorMessage(cause),
      cause,
    }),
  );
  ctx.store.stopRuntime(field);
}

function installDataSource(ctx: FieldContext, field: FieldNode, rule: SchemaRuntimeValue) {
  let version = 0;
  const dispose = effect(() => {
    const currentVersion = ++version;
    const runtime = buildRuntimeContext(ctx, field, "x-reaction", "dataSource");
    const result = executeRuntimeValue(ctx, field, rule, runtime, "dataSource");
    if (!isPromiseLike(result)) {
      field.setLoading(false);
      field.setDataSource(Array.isArray(result) ? result : []);
      return;
    }

    field.setLoading(true);
    result
      .then((value: any) => {
        if (currentVersion !== version) return;
        field.setDataSource(Array.isArray(value) ? value : []);
      })
      .catch((err: any) => {
        if (currentVersion !== version) return;
        ctx.emitError({
          scope: "x-reaction",
          path: field.path,
          key: "dataSource",
          message: errorMessage(err),
          cause: err,
        });
      })
      .finally(() => {
        if (currentVersion === version) field.setLoading(false);
      });
  });
  field._disposers.push(() => {
    version += 1;
    dispose();
  });
}

function formatFieldValue(
  ctx: FieldContext,
  field: FieldNode,
  phase: "input" | "output",
  value: any,
): any {
  const rule = field.schema["x-format"]?.[phase];
  if (rule === undefined) return value;
  const runtime = buildRuntimeContext(ctx, field, "x-format", phase, value);
  try {
    const result = executeRuntimeValue(ctx, field, rule, runtime, phase);
    if (isPromiseLike(result)) {
      ctx.emitError({
        scope: "x-format",
        path: field.path,
        key: phase,
        message: `x-format.${phase} must be synchronous.`,
      });
      return value;
    }
    return result;
  } catch (err) {
    ctx.emitError({
      scope: "x-format",
      path: field.path,
      key: phase,
      message: errorMessage(err),
      cause: err,
    });
    return value;
  }
}

function projectFormValues(
  ctx: FieldContext,
  root: ObjectFieldNode,
  mode: ProjectionMode,
): Record<string, any> {
  return projectChildren(ctx, root.children, mode) || {};
}

function projectNode(ctx: FieldContext, node: FieldNode, mode: ProjectionMode): any {
  if (mode === "output" && node.display() === "none") return undefined;
  let value: any;
  if (isPrimitiveField(node)) value = node.value();
  // 显式 object 字段即使所有子节点为空也保留 {}，避免合法空分组从投影值中丢失
  else if (node.kind === "object") value = projectChildren(ctx, node.children, mode) ?? {};
  else if (node.kind === "array")
    value = node.rows().map((row) => projectChildren(ctx, row.children, mode) || {});
  else if (node.kind === "void") value = projectChildren(ctx, node.children, mode);
  else value = undefined;
  return mode === "output" ? formatFieldValue(ctx, node, "output", value) : value;
}

function projectChildren(
  ctx: FieldContext,
  children: ReadonlyMap<string, FieldNode>,
  mode: ProjectionMode,
): Record<string, any> | undefined {
  const result: Record<string, any> = {};
  for (const [key, child] of children) {
    const value = projectNode(ctx, child, mode);
    if (value === undefined) continue;
    if (child.kind === "void" && value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, value);
      continue;
    }
    result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Applies a partial object without replacing container topology. */
function writeChildren(
  ctx: FieldContext,
  children: ReadonlyMap<string, FieldNode>,
  values: Record<string, any>,
): void {
  for (const [key, child] of children) {
    if (child.kind === "void") {
      writeNode(ctx, child, values);
      continue;
    }
    if (values[key] !== undefined) writeNode(ctx, child, values[key]);
  }
}

/** Writes through field capabilities while reserving row creation for arrays. */
function writeNode(ctx: FieldContext, field: FieldNode, value: any): void {
  if (value === undefined) return;
  if (isPrimitiveField(field)) {
    field.setValue(formatFieldValue(ctx, field, "input", value));
    return;
  }
  if (isArrayField(field)) {
    if (Array.isArray(value)) field.setRows(value);
    return;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const formatted = formatFieldValue(ctx, field, "input", value);
    if (formatted && typeof formatted === "object" && !Array.isArray(formatted)) {
      writeChildren(ctx, field.children, formatted);
    }
  }
}

function collectFieldAndDescendants(field: FieldNode, out: Set<FieldNode>): void {
  if (out.has(field)) return;
  out.add(field);
  if (field.kind === "object" || field.kind === "void") {
    for (const child of field.children.values()) collectFieldAndDescendants(child, out);
  } else if (field.kind === "array") {
    for (const row of field.rows()) {
      for (const child of row.children.values()) collectFieldAndDescendants(child, out);
    }
  }
}

function projectMountedTree(ctx: FieldContext, node: FieldNode): any {
  if (node.display() === "none") return undefined;
  if (node.kind === "void") {
    return projectMountedChildren(ctx, node.children);
  }
  if (ctx.mountedFields.has(node)) {
    return projectNode(ctx, node, "output");
  }
  if (node.kind === "object") {
    return projectMountedChildren(ctx, node.children) ?? {};
  }
  return undefined;
}

function projectMountedChildren(
  ctx: FieldContext,
  children: ReadonlyMap<string, FieldNode>,
): Record<string, any> | undefined {
  const result: Record<string, any> = {};
  for (const [key, child] of children) {
    const value = projectMountedTree(ctx, child);
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
  if (selector === "$value")
    return isPrimitiveField(baseField) ? baseField.value() : projectNode(ctx, baseField, "data");
  if (selector === "$path") return baseField.path;
  const collectionMatch = selector.match(/^(.*)\[\]\.(.+)$/);
  if (collectionMatch) {
    const arrayPath = collectionMatch[1];
    const array =
      arrayPath.startsWith("$row.") && baseField.row
        ? ctx.resolver.rowChild(baseField.row, arrayPath.slice(5))
        : ctx.resolver.field(ctx.form.root, ctx.resolver.relative(baseField, arrayPath));
    const childPath = collectionMatch[2];
    if (!isArrayField(array)) return [];
    return array.rows().map((row) => selectorValue(ctx, ctx.resolver.rowChild(row, childPath)));
  }
  if (selector.startsWith("$row.")) {
    const row = baseField.row;
    if (!row) return undefined;
    return selectorValue(ctx, ctx.resolver.rowChild(row, selector.slice(5)));
  }
  const absolute = ctx.resolver.relative(baseField, selector);
  return selectorValue(ctx, ctx.resolver.field(ctx.form.root, absolute));
}

function selectorValue(ctx: FieldContext, field: FieldNode | undefined): any {
  if (!field) return undefined;
  return projectNode(ctx, field, "data");
}

function buildRuntimeContext(
  ctx: FieldContext,
  field: FieldNode,
  kind: RuntimeRuleContext["kind"],
  key?: string,
  value?: any,
): RuntimeRuleContext {
  const runtime = {
    field,
    form: ctx.form,
    key,
    kind,
    schema: field.schema,
    row: field.row,
    scope: ctx.config.scope || {},
    value,
    getFieldValue(path: NamePath) {
      return resolveSelector(ctx, field, normalizeNamePath(path));
    },
    setFieldValue(path: NamePath, next: any) {
      setSelectorValue(ctx, field, normalizeNamePath(path), next);
    },
    effect(runner: () => void | (() => void)) {
      return effect(runner);
    },
  } as RuntimeRuleContext;
  Object.defineProperty(runtime, "path", {
    enumerable: true,
    get: () => field.path,
  });
  return runtime;
}

function setFieldValue(
  ctx: FieldContext,
  baseField: FieldNode,
  selector: string,
  field: FieldNode | undefined,
  value: any,
) {
  if (isPrimitiveField(field)) field.setValue(value);
  else
    warnInvalid(ctx, field || baseField, "set", `Cannot set non-primitive selector "${selector}".`);
}

function setSelectorValue(ctx: FieldContext, baseField: FieldNode, selector: string, value: any) {
  if (!selector) {
    warnInvalid(ctx, baseField, "set", `Cannot set empty selector.`);
    return;
  }
  // collection selector `<array>[].<child path>` — broadcast write to every row child,
  // mirroring resolveSelector's read support (F1: get/set parity).
  // Checked before the $row branch so `$row.arr[].child` is treated as a collection.
  const collectionMatch = selector.match(/^(.*)\[\]\.(.+)$/);
  if (collectionMatch) {
    const arrayPath = collectionMatch[1];
    const childPath = collectionMatch[2];
    const array =
      arrayPath.startsWith("$row.") && baseField.row
        ? ctx.resolver.rowChild(baseField.row, arrayPath.slice(5))
        : ctx.resolver.field(ctx.form.root, ctx.resolver.relative(baseField, arrayPath));
    if (!isArrayField(array)) {
      warnInvalid(
        ctx,
        array || baseField,
        "set",
        `Cannot set collection "${selector}": "${arrayPath}" is not an array field.`,
      );
      return;
    }
    for (const row of array.rows()) {
      setFieldValue(ctx, baseField, selector, ctx.resolver.rowChild(row, childPath), value);
    }
    return;
  }
  // $row.<child path> — write into the current row, mirroring resolveSelector's read support
  if (selector.startsWith("$row.")) {
    const row = baseField.row;
    if (!row) {
      warnInvalid(ctx, baseField, "set", `Cannot set "${selector}": no enclosing row.`);
      return;
    }
    setFieldValue(ctx, baseField, selector, ctx.resolver.rowChild(row, selector.slice(5)), value);
    return;
  }
  // Resolve absolute and relative selectors against the current row order.
  const resolved = ctx.resolver.relative(baseField, selector);
  setFieldValue(ctx, baseField, selector, ctx.resolver.field(ctx.form.root, resolved), value);
}

function installReactions(ctx: FieldContext, field: FieldNode) {
  const reactions = field.schema["x-reaction"]!;
  for (const [key, raw] of Object.entries(reactions)) {
    const rules = Array.isArray(raw) ? raw : [raw];
    for (const rule of rules) {
      let version = 0;
      const dispose = effect(() => {
        const currentVersion = ++version;
        const runtime = buildRuntimeContext(ctx, field, "x-reaction", key);
        const result = executeRuntimeValue(ctx, field, rule, runtime, key);
        if (isPromiseLike(result)) {
          result
            .then((value: any) => {
              if (currentVersion === version) applyReactionValue(ctx, field, key, value);
            })
            .catch((err: any) => {
              if (currentVersion !== version) return;
              ctx.emitError({
                scope: "x-reaction",
                path: field.path,
                key,
                message: errorMessage(err),
                cause: err,
              });
            });
        } else {
          applyReactionValue(ctx, field, key, result);
        }
      });
      field._disposers.push(() => {
        version += 1;
        dispose();
      });
    }
  }
}

function installEffects(ctx: FieldContext, field: FieldNode, raw: SchemaEffect) {
  const rules = Array.isArray(raw) ? raw : [raw];
  for (const rule of rules) {
    let active = true;
    let cleanup: (() => void) | undefined;
    field._disposers.push(() => {
      active = false;
      cleanup?.();
      cleanup = undefined;
    });
    const runtime = buildRuntimeContext(ctx, field, "x-effect");
    try {
      const result = executeRuntimeValue(ctx, field, rule, runtime, "x-effect");
      if (typeof result === "function") cleanup = result;
      else if (isPromiseLike(result))
        result
          .then((dispose: any) => {
            if (typeof dispose !== "function") return;
            if (active) cleanup = dispose;
            else dispose();
          })
          .catch((err: any) => {
            if (active)
              ctx.emitError({
                scope: "x-effect",
                path: field.path,
                message: errorMessage(err),
                cause: err,
              });
          });
    } catch (err) {
      ctx.emitError({
        scope: "x-effect",
        path: field.path,
        message: errorMessage(err),
        cause: err,
      });
    }
  }
}

function executeRuntimeValue(
  ctx: FieldContext,
  field: FieldNode,
  rule: SchemaRuntimeValue,
  runtime: RuntimeRuleContext,
  key?: string,
): any {
  try {
    const scope = buildExpressionScope(ctx, field, runtime);
    if (typeof rule === "function") return rule(scope);
    if (typeof rule === "string") {
      if (isExpression(rule)) return compileExpr(rule)(scope);
    }
    return rule;
  } catch (err) {
    ctx.emitError({
      scope: runtime.kind,
      path: field.path,
      key,
      message: errorMessage(err),
      cause: err,
    });
    return undefined;
  }
}

function isExpression(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("{{") && trimmed.endsWith("}}");
}

function buildExpressionScope(
  ctx: FieldContext,
  field: FieldNode,
  runtime: RuntimeRuleContext,
): ExpressionScope {
  const injected = ctx.config.scope || {};
  return Object.defineProperties({} as ExpressionScope, {
    mode: { enumerable: true, get: () => injected.mode },
    $self: { enumerable: true, get: () => field },
    $form: { enumerable: true, get: () => ctx.form },
    $value: {
      enumerable: true,
      get: () =>
        runtime.value !== undefined ? runtime.value : resolveSelector(ctx, field, "$value"),
    },
    $row: {
      enumerable: true,
      get: () => (field.row ? projectChildren(ctx, field.row.children, "data") || {} : undefined),
    },
    $path: { enumerable: true, get: () => field.path },
    $service: { enumerable: true, get: () => injected.$service },
    $utils: { enumerable: true, get: () => injected.$utils },
    $enums: { enumerable: true, get: () => injected.$enums },
    $query: { enumerable: true, get: () => injected.$query || {} },
  });
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
    case "display":
      field.setDisplay(value as FieldDisplayTypes);
      break;
    case "disabled":
      field.setDisabled(Boolean(value));
      break;
    case "required":
      field.setRequired(Boolean(value));
      break;
    case "title":
      if (field.title() !== value) field.title(String(value));
      break;
    case "description":
      if (field.description() !== value) field.description(String(value));
      break;
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
    case "component": {
      if (Array.isArray(value)) field.setComponent(value[0], value[1]);
      else field.setComponent(value);
      break;
    }
    case "decorator": {
      if (Array.isArray(value)) field.setDecorator(value[0], value[1]);
      else field.setDecorator(value);
      break;
    }
    case "dataSource":
      field.setDataSource(value);
      break;
    default:
      warnInvalid(ctx, field, key, `Unknown x-reaction target "${key}".`);
  }
}

async function runXValidate(
  ctx: FieldContext,
  field: FieldNode,
  raw: unknown,
  value: any,
): Promise<FieldError[]> {
  const rules = Array.isArray(raw) ? raw : [raw];
  const errors: FieldError[] = [];
  for (const rule of rules) {
    if (!isXValidateRule(rule)) continue;
    const runtime = buildRuntimeContext(ctx, field, "x-validate", "validate", value);
    const result = await executeRuntimeValue(ctx, field, rule, runtime, "validate");
    errors.push(...normalizeValidationErrors(result));
  }
  return errors;
}

function isXValidateRule(value: unknown): value is SchemaXValidateRule {
  return typeof value === "function" || (typeof value === "string" && isExpression(value));
}

function warnInvalid(ctx: FieldContext, field: FieldNode, key: string, message: string) {
  if (typeof console !== "undefined" && console.warn)
    console.warn(`[alien-form] ${message} path=${field.path}`);
  ctx.emitError({ scope: "x-reaction", path: field.path, key, message });
}

function isPromiseLike(value: any): value is Promise<any> {
  return value && typeof value === "object" && typeof value.then === "function";
}

function errorMessage(err: any): string {
  return err instanceof Error ? err.message : String(err);
}

function mountFormRuntime(ctx: FieldContext, root: ObjectFieldNode) {
  batch(() => {
    installFieldRuntime(ctx, root);
  });
}

function unmountFormRuntime(ctx: FieldContext) {
  for (const field of ctx.store.fields.values()) stopFieldRuntime(ctx, field);
}

export function createForm(config: FormConfig = {}): FormInstance {
  const errorListeners = new Set<(e: FormError) => void>(config.onError ? [config.onError] : []);
  const store = new InstanceStore();
  const resolver = new PathResolver(store);
  const mountedFields = new Set<FieldNode>();
  let destroyed = false;
  let mounted = false;
  const effectDisposers = new Set<() => void>();
  const initialValues = config.initialValues ? { ...config.initialValues } : {};
  const scope = { ...config.scope };
  const baseSchema: IFormSchema = config.schema || { type: "object", properties: {} };
  const refDefinitions: Record<string, IFieldSchema> = {
    ...baseSchema.definitions,
    ...config.definitions,
  };
  const schema: IFormSchema =
    Object.keys(refDefinitions).length > 0
      ? { ...baseSchema, definitions: refDefinitions }
      : baseSchema;
  const graph = compileSchemaGraph(schema, refDefinitions, (path, _ref, message) => {
    const publicPath = path.replace(/^\$root\.?/, "").replace(/\[\]/g, "");
    for (const listener of errorListeners) {
      listener({ scope: "ref-resolve", path: publicPath, message });
    }
  });
  const form: FormInstance = {} as FormInstance;
  const ctx: FieldContext = {
    graph,
    store,
    resolver,
    mountedFields,
    config: { ...config, scope },
    initialValues,
    emitError(error) {
      for (const listener of errorListeners) listener(error);
    },
    isMounted() {
      return mounted;
    },
    form,
  };

  const root = buildFieldTree(ctx, graph.root, initialValues) as ObjectFieldNode;

  const submittingSignal = signal(false);
  const fieldsComputed = computed(() => collectFields(root));
  const dataComputed = computed(() => immutableSnapshot(projectFormValues(ctx, root, "data")));
  const errorsComputed = computed(() => {
    const all: FieldError[] = [];
    visitFields(root, (field) => {
      if (isValidatable(field)) all.push(...field.errors());
    });
    return all;
  });
  const validComputed = computed(() => errorsComputed().length === 0);
  const reportFormEffectError = (cause: unknown) =>
    ctx.emitError({
      scope: "x-effect",
      path: "",
      message: errorMessage(cause),
      cause,
    });
  const ownEffectDisposer = (dispose: () => void) => {
    const release = () => {
      effectDisposers.delete(release);
      runDisposers([dispose], reportFormEffectError);
    };
    effectDisposers.add(release);
    return release;
  };

  Object.assign(form, {
    schema,
    scope,
    root,
    fields: fieldsComputed,
    submitting: submittingSignal,
    errors: errorsComputed,
    valid: validComputed,
    field(path: NamePath) {
      return resolver.field(root, normalizeNamePath(path));
    },
    getFieldValue(path: NamePath) {
      return resolveSelector(ctx, root, normalizeNamePath(path));
    },
    setFieldValue(path: NamePath, value: any) {
      setSelectorValue(ctx, root, normalizeNamePath(path), value);
    },
    getFieldsValue(paths?: readonly NamePath[]) {
      if (!paths || paths.length === 0) return projectFormValues(ctx, root, "data");
      const result: Record<string, any> = {};
      for (const path of paths) {
        const name = normalizeNamePath(path);
        const field = resolver.field(root, name);
        if (!field) continue;
        const value = projectNode(ctx, field, "data");
        if (value !== undefined) setDeepValue(result, name, value);
      }
      return result;
    },
    setFieldsValue(values: Record<string, any>) {
      if (!values || typeof values !== "object") return;
      batch(() => {
        writeChildren(ctx, root.children, values);
      });
    },
    getOutput() {
      return immutableSnapshot(projectFormValues(ctx, root, "output"));
    },
    setInitialValues(values: Record<string, any>) {
      ctx.initialValues = { ...values };
    },
    setScope(values: Record<string, any>) {
      Object.assign(scope, values);
    },
    resetFields(paths?: readonly NamePath[]) {
      batch(() => {
        if (!paths || paths.length === 0) {
          root.reset();
        } else {
          for (const path of paths) resolver.field(root, normalizeNamePath(path))?.reset();
        }
      });
    },
    mount() {
      if (destroyed || mounted) return;
      mounted = true;
      mountFormRuntime(ctx, root);
    },
    unmount() {
      if (!mounted) return;
      mounted = false;
      unmountFormRuntime(ctx);
    },
    async validate(names?: readonly NamePath[]) {
      let targets: FieldNode[];
      if (!names || names.length === 0) {
        targets = listFields(root).filter((field) => isValidatable(field));
      } else {
        const seen = new Set<FieldNode>();
        for (const name of names) {
          const field = resolver.field(root, normalizeNamePath(name));
          if (field) collectFieldAndDescendants(field, seen);
        }
        targets = Array.from(seen).filter((f) => isValidatable(f));
      }
      const results = await Promise.all(targets.map((f) => f.validate()));
      return results.every((errors) => errors.length === 0);
    },
    async validateFast() {
      const targets = Array.from(mountedFields).filter((f) => isValidatable(f));
      const results = await Promise.all(targets.map((f) => f.validate()));
      return results.every((errors) => errors.length === 0);
    },
    getFieldsValueFast() {
      return projectMountedTree(ctx, root) || {};
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
        const output = form.getOutput();
        return onSubmit ? await onSubmit(output) : (output as T);
      } finally {
        submittingSignal(false);
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      form.unmount();
      root.dispose();
      mountedFields.clear();
      runDisposers([...effectDisposers], reportFormEffectError);
      effectDisposers.clear();
      errorListeners.clear();
    },
    _registerField(field: FieldNode) {
      mountedFields.add(field);
    },
    _unregisterField(field: FieldNode) {
      mountedFields.delete(field);
    },
    onError(listener: (error: FormError) => void) {
      errorListeners.add(listener);
      return () => {
        errorListeners.delete(listener);
      };
    },
    effect<T>(
      runnerOrSelector: ((form: FormInstance) => void | (() => void)) | ((form: FormInstance) => T),
      listener?: (value: T, prev: T | undefined) => void,
      options?: { immediate?: boolean; equals?: (a: T, b: T) => boolean },
    ) {
      if (!listener) {
        const dispose = effect(() => {
          if (!destroyed)
            return (runnerOrSelector as (form: FormInstance) => void | (() => void))(form);
        });
        return ownEffectDisposer(dispose);
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
      return ownEffectDisposer(dispose);
    },
  } as FormInstance);

  Object.defineProperty(form, "data", {
    enumerable: true,
    get: () => untracked(dataComputed),
  });

  return form;
}

export { sortByOrder, setDeepValue, getDeepValue };
