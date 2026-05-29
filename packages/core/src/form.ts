/**
 * @alien-form/core — Form engine (atomic signal-per-property)
 *
 * Design principles:
 * 1. Schema is configuration — passed at createForm(), not mutated at runtime
 * 2. Three-phase initialization: atoms → signal → reactions
 * 3. Reaction effects are field lifecycle — installed after all fields exist
 * 4. Each field property is an independent signal atom
 * 5. No render-phase side effects required from framework layer
 */

import { signal, computed, effect, startBatch, endBatch } from "alien-signals";
import type {
  FieldAtoms,
  FieldError,
  DataSourceItem,
  FieldDisplayTypes,
  FormConfig,
  FormError,
  FormInstance,
  IFieldSchema,
  IFormSchema,
  SchemaXRule,
  SchemaRuleSet,
  SchemaReactions,
  SchemaFormat,
  SchemaXValidate,
  RuntimeRuleHandler,
  ValidateStatus,
} from "./types";
import { evaluateExpression } from "./expression";
import { isEmptyValue, normalizeDataSource, runStaticValidate, normalizeValidationErrors } from "./validation";
import { getDeepValue, setDeepValue, sortByOrder, resolveFieldPath } from "./path";
import { resolveSchemaRef, resolveSchemaTree } from "./ref-resolve";

// ─── Field Atom Factory ─────────────────────────────────────────────────────
// Creates pure atoms without installing reactions (Phase 1)

function createFieldAtoms(
  path: string,
  schema: IFieldSchema,
  initialValue?: any,
): FieldAtoms {
  const isArrayField = schema.type === "array" && !!schema.items && !Array.isArray(schema.items);
  const defaultValue = initialValue !== undefined ? initialValue : schema.default;
  const fieldValue = isArrayField
    ? (Array.isArray(defaultValue) ? defaultValue : [])
    : defaultValue;

  // Placeholder — form reference set after createForm constructs the instance
  let formRef: FormInstance = null as any;
  let fieldsMapRef: Map<string, FieldAtoms> = null as any;

  const atoms: FieldAtoms = {
    path,
    schema,
    isArrayField,
    _disposers: [],

    // Atomic signals — each independently subscribable
    value: signal(fieldValue),
    display: signal<FieldDisplayTypes>(schema.display || "visible"),
    disabled: signal(schema.disabled === true),
    required: signal(schema.required === true || schema.validate?.required === true),
    errors: signal<FieldError[]>([]),
    warnings: signal<FieldError[]>([]),
    validateStatus: signal<ValidateStatus>(""),
    title: signal(schema.title || ""),
    description: signal(schema.description || ""),
    component: signal(schema.component || "Input"),
    componentProps: signal<Record<string, any>>(schema.props || {}),
    decorator: signal(schema.decorator || "FormItem"),
    decoratorProps: signal<Record<string, any>>(schema.decoratorProps || {}),
    dataSource: signal<DataSourceItem[]>(normalizeDataSource(schema.dataSource)),
    loading: signal(false),
    arrayRows: signal(isArrayField ? (Array.isArray(fieldValue) ? fieldValue.length : 0) : 0),

    // ─── Methods (bound to form after construction) ──────────────────
    setValue(value: any) {
      if (atoms.isArrayField) {
        const arr = Array.isArray(value) ? value : [];
        setArrayValue(formRef, fieldsMapRef, atoms, arr);
        return;
      }
      if (Object.is(atoms.value(), value)) return;
      atoms.value(value);
    },

    setErrors(errors: FieldError[]) {
      atoms.errors(errors);
      atoms.validateStatus(errors.length > 0 ? "error" : "success");
    },

    setWarnings(warnings: FieldError[]) {
      atoms.warnings(warnings);
    },

    setDisplay(display: FieldDisplayTypes) {
      if (atoms.display() === display) return;
      atoms.display(display);
    },

    setDisabled(value: boolean) {
      if (atoms.disabled() === value) return;
      atoms.disabled(value);
    },

    setRequired(value: boolean) {
      if (atoms.required() === value) return;
      atoms.required(value);
    },

    setLoading(loading: boolean) {
      if (atoms.loading() === loading) return;
      atoms.loading(loading);
    },

    setDataSource(ds: DataSourceItem[]) {
      atoms.dataSource(normalizeDataSource(ds));
    },

    setComponent(component: string, props?: Record<string, any>) {
      atoms.component(component);
      if (props !== undefined) atoms.componentProps(props);
    },

    setDecorator(decorator: string, props?: Record<string, any>) {
      atoms.decorator(decorator);
      if (props !== undefined) atoms.decoratorProps(props);
    },

    async validate(): Promise<FieldError[]> {
      if (atoms.display() === "none") return [];
      atoms.validateStatus("validating");
      const errors: FieldError[] = [];
      const value = atoms.value();

      // Static validation
      const staticErrors = runStaticValidate(schema.validate, value);
      errors.push(...staticErrors);

      // Required check from signal
      if (atoms.required() && !schema.validate?.required && isEmptyValue(value)) {
        errors.push({ message: `${atoms.title() || path} is required`, type: "required" });
      }

      // x-validate
      if (schema["x-validate"]) {
        const dynamicErrors = await runXValidate(formRef, fieldsMapRef, atoms, schema["x-validate"], value);
        errors.push(...dynamicErrors);
      }

      atoms.errors(errors);
      atoms.validateStatus(errors.length > 0 ? "error" : "success");
      return errors;
    },

    reset() {
      startBatch();
      atoms.value(fieldValue);
      atoms.errors([]);
      atoms.warnings([]);
      atoms.validateStatus("");
      if (isArrayField) {
        resetArrayRows(formRef, fieldsMapRef, atoms, fieldValue);
      }
      endBatch();
    },

    dispose() {
      for (const d of atoms._disposers) d();
      atoms._disposers.length = 0;
    },

    // Array methods
    push(initialValues?: any) {
      if (!atoms.isArrayField) return;
      pushArrayRow(formRef, fieldsMapRef, atoms, initialValues);
    },

    remove(index: number) {
      if (!atoms.isArrayField) return;
      removeArrayRow(formRef, fieldsMapRef, atoms, index);
    },

    moveUp(index: number) {
      if (!atoms.isArrayField || index <= 0) return;
      swapArrayRows(formRef, fieldsMapRef, atoms, index, index - 1);
    },

    moveDown(index: number) {
      if (!atoms.isArrayField || index >= atoms.arrayRows() - 1) return;
      swapArrayRows(formRef, fieldsMapRef, atoms, index, index + 1);
    },
  };

  // Bind form/fieldsMap reference (set by createForm after construction)
  (atoms as any)._bindForm = (form: FormInstance, map: Map<string, FieldAtoms>) => {
    formRef = form;
    fieldsMapRef = map;
  };

  return atoms;
}

// ─── Per-field Reaction Installation (Phase 3) ─────────────────────────────

function installFieldReactions(form: FormInstance, fieldsMap: Map<string, FieldAtoms>, atoms: FieldAtoms): void {
  const reactions = atoms.schema["x-reaction"]!;

  for (const [reactionKey, ruleOrRules] of Object.entries(reactions)) {
    if (!ruleOrRules) continue;
    const rules = Array.isArray(ruleOrRules) ? ruleOrRules : [ruleOrRules];

    for (const rule of rules) {
      const hasDeps = rule.dependencies && (
        (Array.isArray(rule.dependencies) && rule.dependencies.length > 0) ||
        (!Array.isArray(rule.dependencies) && Object.keys(rule.dependencies).length > 0)
      );

      const dispose = effect(() => {
        // Track ONLY the dependency field value signals
        // Use atoms.path (dynamic) for relative path resolution
        const { deps, depsArray } = resolveDeps(fieldsMap, rule.dependencies, atoms.path);

        // If no explicit deps, track self value as the trigger
        if (!hasDeps) {
          void atoms.value();
        }

        const scope = buildScope(form, atoms, deps, depsArray);
        const result = resolveXRuleValue(form, atoms, reactionKey, rule, scope);

        if (result && typeof result === "object" && typeof result.then === "function") {
          result.then((resolved: any) => applyReactionValue(atoms, reactionKey, resolved))
            .catch((err: any) => emitError(form, {
              scope: "x-reaction", path: atoms.path, key: reactionKey,
              message: err instanceof Error ? err.message : String(err), cause: err,
            }));
        } else {
          applyReactionValue(atoms, reactionKey, result);
        }
      });
      atoms._disposers.push(dispose);
    }
  }
}

// ─── Array Operations ───────────────────────────────────────────────────────

function getItemSchema(atoms: FieldAtoms): IFieldSchema | null {
  const items = atoms.schema.items;
  if (!items || Array.isArray(items)) return null;
  return items as IFieldSchema;
}

function createRowFields(
  form: FormInstance,
  fieldsMap: Map<string, FieldAtoms>,
  atoms: FieldAtoms,
  index: number,
  initialValues?: any,
): FieldAtoms[] {
  const itemSchema = getItemSchema(atoms);
  if (!itemSchema) return [];

  const created: FieldAtoms[] = [];

  if (itemSchema.properties) {
    const sorted = sortByOrder(itemSchema.properties);
    for (const [key, childSchema] of sorted) {
      const childPath = `${atoms.path}.${index}.${key}`;
      const childValue = initialValues ? initialValues[key] : undefined;
      const newAtoms = buildFieldTree(form, fieldsMap, childPath, childSchema, childValue, itemSchema.required);
      created.push(...newAtoms);
    }
  } else {
    const childPath = `${atoms.path}.${index}`;
    const childAtoms = createFieldAtoms(childPath, itemSchema, initialValues);
    (childAtoms as any)._bindForm(form, fieldsMap);
    fieldsMap.set(childPath, childAtoms);
    created.push(childAtoms);
  }

  return created;
}

function pushArrayRow(form: FormInstance, fieldsMap: Map<string, FieldAtoms>, atoms: FieldAtoms, initialValues?: any) {
  const newIndex = atoms.arrayRows();

  startBatch();
  // Phase 1: create all row field atoms
  const created = createRowFields(form, fieldsMap, atoms, newIndex, initialValues);

  // Phase 2: install reactions for new row fields (all siblings now exist)
  for (const field of created) {
    if (field.schema["x-reaction"]) {
      installFieldReactions(form, fieldsMap, field);
    }
  }

  atoms.arrayRows(newIndex + 1);
  const current = Array.isArray(atoms.value()) ? [...atoms.value()] : [];
  current.push(initialValues || {});
  atoms.value(current);

  // Notify React
  form.fields(new Map(fieldsMap));
  endBatch();
}

function removeArrayRow(form: FormInstance, fieldsMap: Map<string, FieldAtoms>, atoms: FieldAtoms, index: number) {
  const currentRows = atoms.arrayRows();
  if (index < 0 || index >= currentRows) return;

  startBatch();

  // Dispose and delete row fields
  const rowPrefix = `${atoms.path}.${index}`;
  for (const key of Array.from(fieldsMap.keys())) {
    if (key === rowPrefix || key.startsWith(`${rowPrefix}.`)) {
      const field = fieldsMap.get(key);
      if (field) field.dispose();
      fieldsMap.delete(key);
    }
  }

  // Rename subsequent rows
  for (let row = index + 1; row < currentRows; row++) {
    const fromPrefix = `${atoms.path}.${row}`;
    const toPrefix = `${atoms.path}.${row - 1}`;
    const toRename: [string, FieldAtoms][] = [];
    for (const [key, field] of fieldsMap) {
      if (key === fromPrefix || key.startsWith(`${fromPrefix}.`)) {
        toRename.push([key, field]);
      }
    }
    for (const [fromKey, field] of toRename) {
      fieldsMap.delete(fromKey);
      const toKey = toPrefix + fromKey.slice(fromPrefix.length);
      (field as any).path = toKey;
      fieldsMap.set(toKey, field);
    }
  }

  atoms.arrayRows(currentRows - 1);
  const current = Array.isArray(atoms.value()) ? [...atoms.value()] : [];
  current.splice(index, 1);
  atoms.value(current);

  form.fields(new Map(fieldsMap));
  endBatch();
}

function swapArrayRows(form: FormInstance, fieldsMap: Map<string, FieldAtoms>, atoms: FieldAtoms, indexA: number, indexB: number) {
  const prefixA = `${atoms.path}.${indexA}`;
  const prefixB = `${atoms.path}.${indexB}`;

  startBatch();
  const entriesA: [string, FieldAtoms][] = [];
  const entriesB: [string, FieldAtoms][] = [];

  for (const [path, field] of fieldsMap) {
    if (path === prefixA || path.startsWith(`${prefixA}.`)) entriesA.push([path, field]);
    else if (path === prefixB || path.startsWith(`${prefixB}.`)) entriesB.push([path, field]);
  }

  for (const [p] of entriesA) fieldsMap.delete(p);
  for (const [p] of entriesB) fieldsMap.delete(p);

  for (const [fromPath, field] of entriesA) {
    const toPath = prefixB + fromPath.slice(prefixA.length);
    (field as any).path = toPath;
    fieldsMap.set(toPath, field);
  }
  for (const [fromPath, field] of entriesB) {
    const toPath = prefixA + fromPath.slice(prefixB.length);
    (field as any).path = toPath;
    fieldsMap.set(toPath, field);
  }

  // Swap values
  const current = Array.isArray(atoms.value()) ? [...atoms.value()] : [];
  const tmp = current[indexA];
  current[indexA] = current[indexB];
  current[indexB] = tmp;
  atoms.value(current);

  form.fields(new Map(fieldsMap));
  endBatch();
}

function setArrayValue(form: FormInstance, fieldsMap: Map<string, FieldAtoms>, atoms: FieldAtoms, value: any[]) {
  const itemSchema = getItemSchema(atoms);
  if (!itemSchema) return;

  startBatch();
  const currentRows = atoms.arrayRows();

  // Remove excess rows (dispose their reactions)
  for (let i = currentRows - 1; i >= value.length; i--) {
    const prefix = `${atoms.path}.${i}`;
    for (const key of Array.from(fieldsMap.keys())) {
      if (key === prefix || key.startsWith(`${prefix}.`)) {
        const field = fieldsMap.get(key);
        if (field) field.dispose();
        fieldsMap.delete(key);
      }
    }
  }

  // Create/update rows
  const newlyCreated: FieldAtoms[] = [];
  for (let i = 0; i < value.length; i++) {
    if (i >= currentRows) {
      const created = createRowFields(form, fieldsMap, atoms, i, value[i]);
      newlyCreated.push(...created);
    } else if (itemSchema.properties) {
      for (const key of Object.keys(itemSchema.properties)) {
        const field = fieldsMap.get(`${atoms.path}.${i}.${key}`);
        if (field) field.setValue(value[i]?.[key]);
      }
    }
  }

  // Install reactions for newly created fields
  for (const field of newlyCreated) {
    if (field.schema["x-reaction"]) {
      installFieldReactions(form, fieldsMap, field);
    }
  }

  atoms.arrayRows(value.length);
  atoms.value(value);
  form.fields(new Map(fieldsMap));
  endBatch();
}

function resetArrayRows(form: FormInstance, fieldsMap: Map<string, FieldAtoms>, atoms: FieldAtoms, initialValue: any) {
  setArrayValue(form, fieldsMap, atoms, Array.isArray(initialValue) ? initialValue : []);
}

// ─── Reaction Runtime ───────────────────────────────────────────────────────

function resolveXRuleValue(
  form: FormInstance,
  fieldAtoms: FieldAtoms | undefined,
  key: string,
  rule: SchemaXRule,
  scope: Record<string, any>,
): any {
  switch (rule.type) {
    case "static": return rule.value;
    case "expression": return evaluateExpression(rule.expression, scope);
    case "match": {
      let source: any;
      if (rule.source) source = evaluateExpression(rule.source, scope);
      else {
        const deps = scope.$deps;
        source = Array.isArray(deps) ? deps[0] : Object.values(deps)[0];
      }
      const matchKey = source == null ? "default" : String(source);
      return Object.prototype.hasOwnProperty.call(rule.match, matchKey) ? rule.match[matchKey] : rule.match.default;
    }
    case "computed": {
      const config = (form as any)._config as FormConfig;
      const handler = config.handlers?.[rule.handler];
      if (!handler) return undefined;
      return handler({
        field: fieldAtoms!,
        form,
        get values() { return form.values(); },
        deps: scope.$dependencies || {},
        dependencies: scope.$dependencies || {},
        scope,
        key,
        rule,
        get value() { return fieldAtoms!.value(); },
        kind: "x-reaction",
      });
    }
  }
}

function resolveDeps(fieldsMap: Map<string, FieldAtoms>, dependencies: string[] | Record<string, string> | undefined, selfPath: string) {
  const deps: Record<string, any> = {};
  const depsArray: any[] = [];
  if (!dependencies) return { deps, depsArray };

  if (Array.isArray(dependencies)) {
    for (const depPath of dependencies) {
      const resolved = resolveFieldPath(depPath, selfPath);
      const depField = fieldsMap.get(resolved);
      const value = depField ? depField.value() : undefined; // ← tracks dep.value signal
      depsArray.push(value);
      deps[depPath] = value;
    }
  } else {
    for (const [alias, depPath] of Object.entries(dependencies)) {
      const resolved = resolveFieldPath(depPath, selfPath);
      const depField = fieldsMap.get(resolved);
      deps[alias] = depField ? depField.value() : undefined; // ← tracks dep.value signal
    }
  }
  return { deps, depsArray };
}

function buildScope(form: FormInstance, fieldAtoms: FieldAtoms, deps: Record<string, any>, depsArray: any[]): Record<string, any> {
  const config = (form as any)._config as FormConfig;
  return {
    $self: fieldAtoms,
    $form: form,
    get $values() { return form.values(); },  // lazy — only tracked if handler reads it
    $deps: depsArray.length > 0 ? depsArray : deps,
    $dependencies: deps,
    get $value() { return fieldAtoms.value(); },  // lazy
    ...(config.scope || {}),
  };
}

function applyReactionValue(fieldAtoms: FieldAtoms, reactionKey: string, value: any): void {
  if (value === undefined) return;
  switch (reactionKey) {
    case "value": fieldAtoms.setValue(value); break;
    case "display": fieldAtoms.setDisplay(value); break;
    case "disabled": fieldAtoms.setDisabled(Boolean(value)); break;
    case "required": fieldAtoms.setRequired(Boolean(value)); break;
    case "title": fieldAtoms.title(value); break;
    case "description": fieldAtoms.description(value); break;
    case "props": fieldAtoms.componentProps({ ...fieldAtoms.componentProps(), ...value }); break;
    case "decoratorProps": fieldAtoms.decoratorProps({ ...fieldAtoms.decoratorProps(), ...value }); break;
    case "component": if (Array.isArray(value)) fieldAtoms.setComponent(value[0], value[1]); else fieldAtoms.setComponent(value); break;
    case "decorator": if (Array.isArray(value)) fieldAtoms.setDecorator(value[0], value[1]); else fieldAtoms.setDecorator(value); break;
    case "dataSource": fieldAtoms.setDataSource(normalizeDataSource(value)); break;
  }
}

async function runXValidate(form: FormInstance, fieldsMap: Map<string, FieldAtoms>, fieldAtoms: FieldAtoms, rules: SchemaXValidate, value: any): Promise<FieldError[]> {
  const ruleList = Array.isArray(rules) ? rules : [rules];
  const errors: FieldError[] = [];
  const config = (form as any)._config as FormConfig;

  for (const rule of ruleList) {
    const { deps, depsArray } = resolveDeps(fieldsMap, rule.dependencies, fieldAtoms.path);
    const scope = {
      $self: fieldAtoms,
      $form: form,
      $values: form.values(),
      $deps: depsArray.length > 0 ? depsArray : deps,
      $dependencies: deps,
      $value: value,
      ...(config.scope || {}),
    };
    const result = await resolveXRuleValue(form, fieldAtoms, "validate", rule, scope);
    errors.push(...normalizeValidationErrors(result));
  }
  return errors;
}

// ─── Schema → Field Tree Building (Phase 1) ────────────────────────────────
// Pure construction — no reactions, no signal writes to fieldsSignal

function buildFieldTree(
  form: FormInstance,
  fieldsMap: Map<string, FieldAtoms>,
  path: string,
  rawSchema: IFieldSchema,
  initialValue?: any,
  parentRequired?: boolean | string[],
): FieldAtoms[] {
  const definitions = (form as any)._definitions as Record<string, IFieldSchema>;
  const schema = resolveSchemaTree(rawSchema, definitions, (ref, msg) => {
    emitError(form, { scope: "ref-resolve", path: "", message: msg });
  });

  const parts = path.split(".");
  const key = parts[parts.length - 1] || path;
  const isRequired = schema.required === true || (Array.isArray(parentRequired) && parentRequired.includes(key));
  const mergedSchema = { ...schema, required: isRequired };

  const created: FieldAtoms[] = [];

  if (schema.type === "array" && schema.items && !Array.isArray(schema.items)) {
    const iv = initialValue !== undefined ? initialValue : getDeepValue((form as any)._initialValues, path);
    const atoms = createFieldAtoms(path, mergedSchema, iv);
    (atoms as any)._bindForm(form, fieldsMap);
    fieldsMap.set(path, atoms);
    created.push(atoms);

    // Create initial rows
    if (Array.isArray(iv) && schema.items.properties) {
      const itemSchema = schema.items as IFieldSchema;
      for (let i = 0; i < iv.length; i++) {
        const sorted = sortByOrder(itemSchema.properties!);
        for (const [childKey, childSchema] of sorted) {
          const childCreated = buildFieldTree(form, fieldsMap, `${path}.${i}.${childKey}`, childSchema, iv[i]?.[childKey], itemSchema.required);
          created.push(...childCreated);
        }
      }
    }
    return created;
  }

  if (schema.type === "object" && schema.properties) {
    if (schema.component) {
      const atoms = createFieldAtoms(path, mergedSchema, initialValue);
      (atoms as any)._bindForm(form, fieldsMap);
      fieldsMap.set(path, atoms);
      created.push(atoms);
    }
    const sorted = sortByOrder(schema.properties);
    for (const [childKey, childSchema] of sorted) {
      const childIv = initialValue != null ? initialValue[childKey] : getDeepValue((form as any)._initialValues, `${path}.${childKey}`);
      const childCreated = buildFieldTree(form, fieldsMap, `${path}.${childKey}`, childSchema, childIv, schema.required);
      created.push(...childCreated);
    }
    return created;
  }

  if (schema.type === "void") {
    const preserveOwnPath = !!rawSchema.$ref;
    const childPrefix = preserveOwnPath ? path : (path.includes(".") ? path.slice(0, path.lastIndexOf(".")) : "");
    if (schema.component) {
      const atoms = createFieldAtoms(path, mergedSchema, initialValue);
      (atoms as any)._bindForm(form, fieldsMap);
      fieldsMap.set(path, atoms);
      created.push(atoms);
    }
    if (schema.properties) {
      const sorted = sortByOrder(schema.properties);
      for (const [childKey, childSchema] of sorted) {
        const childPath = childPrefix ? `${childPrefix}.${childKey}` : childKey;
        const childCreated = buildFieldTree(form, fieldsMap, childPath, childSchema, undefined, schema.required);
        created.push(...childCreated);
      }
    }
    return created;
  }

  // Leaf field
  const iv = initialValue !== undefined ? initialValue : getDeepValue((form as any)._initialValues, path);
  const atoms = createFieldAtoms(path, mergedSchema, iv);
  (atoms as any)._bindForm(form, fieldsMap);
  fieldsMap.set(path, atoms);
  created.push(atoms);
  return created;
}

// ─── Error Handling ─────────────────────────────────────────────────────────

function emitError(form: FormInstance, error: FormError): void {
  const listeners = (form as any)._errorListeners as Set<(e: FormError) => void>;
  if (listeners.size === 0) {
    console.warn(`[alien-form] [${error.scope}] ${error.path || "<form>"}: ${error.message}`);
    return;
  }
  for (const listener of listeners) {
    try { listener(error); } catch (e) { console.error("[alien-form] onError threw:", e); }
  }
}

// ─── createForm ─────────────────────────────────────────────────────────────

export function createForm(config: FormConfig = {}): FormInstance {
  const errorListeners = new Set<(e: FormError) => void>(config.onError ? [config.onError] : []);
  let destroyed = false;
  let setupDispose: (() => void) | null = null;
  const initialValues = config.initialValues ? { ...config.initialValues } : {};
  const definitions: Record<string, IFieldSchema> = config.schema?.definitions || {};
  const effectDisposers = new Set<() => void>();

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 1: Build all field atoms (no signals written, no reactions)
  // ═══════════════════════════════════════════════════════════════════════════

  const fieldsMap = new Map<string, FieldAtoms>();

  // Partial form object needed during tree building (for error emission & definitions)
  const form: FormInstance = {} as FormInstance;
  (form as any)._config = config;
  (form as any)._errorListeners = errorListeners;
  (form as any)._definitions = definitions;
  (form as any)._initialValues = initialValues;

  if (config.schema?.properties) {
    const sorted = sortByOrder(config.schema.properties);
    for (const [key, fieldSchema] of sorted) {
      buildFieldTree(form, fieldsMap, key, fieldSchema, undefined, config.schema.required);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2: Create signals (single write, React notified once)
  // ═══════════════════════════════════════════════════════════════════════════

  const fieldsSignal = signal(fieldsMap);
  const submittingSignal = signal(false);

  const valuesComputed = computed(() => {
    const result: Record<string, any> = {};
    const map = fieldsSignal();
    for (const [path, atoms] of map) {
      if (atoms.display() === "none") continue;
      if (atoms.isArrayField) {
        const itemSchema = getItemSchema(atoms);
        if (itemSchema?.properties) {
          const rows: any[] = [];
          const rowCount = atoms.arrayRows();
          for (let i = 0; i < rowCount; i++) {
            const row: Record<string, any> = {};
            for (const key of Object.keys(itemSchema.properties)) {
              const childField = map.get(`${path}.${i}.${key}`);
              if (childField && childField.display() !== "none") {
                row[key] = childField.value();
              }
            }
            rows.push(row);
          }
          setDeepValue(result, path, rows);
        } else {
          setDeepValue(result, path, atoms.value());
        }
        continue;
      }
      if (isArrayChildPath(map, path)) continue;
      if (atoms.schema.type === "void") continue;
      setDeepValue(result, path, atoms.value());
    }
    return result;
  });

  const errorsComputed = computed(() => {
    const allErrors: FieldError[] = [];
    for (const [, atoms] of fieldsSignal()) {
      if (atoms.display() !== "none") allErrors.push(...atoms.errors());
    }
    return allErrors;
  });

  const validComputed = computed(() => errorsComputed().length === 0);

  // ═══════════════════════════════════════════════════════════════════════════
  // Assemble form instance
  // ═══════════════════════════════════════════════════════════════════════════

  Object.assign(form, {
    schema: config.schema || { type: "object" as const },
    fields: fieldsSignal,
    submitting: submittingSignal,
    values: valuesComputed,
    errors: errorsComputed,
    valid: validComputed,

    field(path: string) {
      return fieldsSignal().get(path);
    },

    setValues(values: Record<string, any>) {
      if (!values || typeof values !== "object") return;
      startBatch();
      const map = fieldsSignal();
      const entries = Array.from(map.entries()).sort(([, a], [, b]) => {
        if (a.isArrayField !== b.isArrayField) return a.isArrayField ? -1 : 1;
        return 0;
      });
      for (const [path, atoms] of entries) {
        if (isArrayChildPath(map, path)) continue;
        const value = getDeepValue(values, path);
        if (value !== undefined) atoms.setValue(value);
      }
      endBatch();
    },

    setInitialValues(values: Record<string, any>) {
      (form as any)._initialValues = { ...values };
    },

    reset() {
      startBatch();
      for (const atoms of fieldsSignal().values()) atoms.reset();
      endBatch();
    },

    async validate() {
      const results = await Promise.all(
        Array.from(fieldsSignal().values())
          .filter((atoms) => atoms.display() !== "none")
          .map((atoms) => atoms.validate()),
      );
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
      } finally {
        submittingSignal(false);
      }
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const atoms of fieldsSignal().values()) atoms.dispose();
      if (setupDispose) setupDispose();
      for (const d of effectDisposers) d();
      effectDisposers.clear();
      errorListeners.clear();
    },

    onError(listener: (error: FormError) => void) {
      errorListeners.add(listener);
      return () => { errorListeners.delete(listener); };
    },

    effect<T>(
      runnerOrSelector: ((form: FormInstance) => void | (() => void)) | ((form: FormInstance) => T),
      listener?: (value: T, prev: T | undefined) => void,
      options?: { immediate?: boolean; equals?: (a: T, b: T) => boolean },
    ): () => void {
      if (!listener) {
        const dispose = effect(() => {
          if (destroyed) return;
          return (runnerOrSelector as (form: FormInstance) => void | (() => void))(form);
        });
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
  } satisfies Omit<FormInstance, 'fields' | 'submitting' | 'values' | 'errors' | 'valid'> & { schema: IFormSchema });

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 3: Install all reactions (all fields now exist in fieldsMap)
  // ═══════════════════════════════════════════════════════════════════════════

  startBatch();
  for (const atoms of fieldsMap.values()) {
    if (atoms.schema["x-reaction"]) {
      installFieldReactions(form, fieldsMap, atoms);
    }
  }
  endBatch();

  // Run user setup
  if (config.setup) {
    const dispose = config.setup(form);
    if (typeof dispose === "function") setupDispose = dispose;
  }

  return form;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isArrayChildPath(fieldsMap: Map<string, FieldAtoms>, path: string): boolean {
  const parts = path.split(".");
  for (let i = 1; i < parts.length; i++) {
    const parentPath = parts.slice(0, i).join(".");
    const parent = fieldsMap.get(parentPath);
    if (parent?.isArrayField) return true;
  }
  return false;
}
