/**
 * @alien-form/core — Form engine (atomic signal-per-property)
 *
 * Each field property is an independent alien-signal atom.
 * React (or any framework) subscribes directly to individual signals.
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

function createFieldAtoms(
  form: FormInstance,
  path: string,
  schema: IFieldSchema,
  initialValue?: any,
): FieldAtoms {
  const isArrayField = schema.type === "array" && !!schema.items && !Array.isArray(schema.items);
  const defaultValue = initialValue !== undefined ? initialValue : schema.default;
  const fieldValue = isArrayField
    ? (Array.isArray(defaultValue) ? defaultValue : [])
    : defaultValue;

  const atoms: FieldAtoms = {
    path,
    schema,
    isArrayField,
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

    // ─── Methods ──────────────────────────────────────────────────────
    setValue(value: any) {
      if (atoms.isArrayField) {
        const arr = Array.isArray(value) ? value : [];
        setArrayValue(form, atoms, arr);
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
        const dynamicErrors = await runXValidate(form, atoms, schema["x-validate"], value);
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
        resetArrayRows(form, atoms, fieldValue);
      }
      endBatch();
    },

    // Array methods
    push(initialValues?: any) {
      if (!atoms.isArrayField) return;
      pushArrayRow(form, atoms, initialValues);
    },

    remove(index: number) {
      if (!atoms.isArrayField) return;
      removeArrayRow(form, atoms, index);
    },

    moveUp(index: number) {
      if (!atoms.isArrayField || index <= 0) return;
      swapArrayRows(form, atoms, index, index - 1);
    },

    moveDown(index: number) {
      if (!atoms.isArrayField || index >= atoms.arrayRows() - 1) return;
      swapArrayRows(form, atoms, index, index + 1);
    },
  };

  return atoms;
}

// ─── Array Operations ───────────────────────────────────────────────────────

function getItemSchema(atoms: FieldAtoms): IFieldSchema | null {
  const items = atoms.schema.items;
  if (!items || Array.isArray(items)) return null;
  return items as IFieldSchema;
}

function createRowFields(form: FormInstance, atoms: FieldAtoms, index: number, initialValues?: any) {
  const itemSchema = getItemSchema(atoms);
  if (!itemSchema) return;

  if (itemSchema.properties) {
    const sorted = sortByOrder(itemSchema.properties);
    for (const [key, childSchema] of sorted) {
      const childPath = `${atoms.path}.${index}.${key}`;
      const childValue = initialValues ? initialValues[key] : undefined;
      createFieldTree(form, childPath, childSchema, childValue, itemSchema.required);
    }
  } else {
    form.createField(`${atoms.path}.${index}`, itemSchema, initialValues);
  }
}

function pushArrayRow(form: FormInstance, atoms: FieldAtoms, initialValues?: any) {
  const newIndex = atoms.arrayRows();
  createRowFields(form, atoms, newIndex, initialValues);
  atoms.arrayRows(newIndex + 1);
  // Update stored value
  const current = Array.isArray(atoms.value()) ? [...atoms.value()] : [];
  current.push(initialValues || {});
  atoms.value(current);
}

function removeArrayRow(form: FormInstance, atoms: FieldAtoms, index: number) {
  const currentRows = atoms.arrayRows();
  if (index < 0 || index >= currentRows) return;

  startBatch();
  const fieldsMap = form.fields();

  // Delete row fields
  const rowPrefix = `${atoms.path}.${index}`;
  for (const key of Array.from(fieldsMap.keys())) {
    if (key === rowPrefix || key.startsWith(`${rowPrefix}.`)) {
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
  // Update value
  const current = Array.isArray(atoms.value()) ? [...atoms.value()] : [];
  current.splice(index, 1);
  atoms.value(current);

  // Trigger fields signal update
  form.fields(new Map(fieldsMap));
  endBatch();
}

function swapArrayRows(form: FormInstance, atoms: FieldAtoms, indexA: number, indexB: number) {
  const fieldsMap = form.fields();
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

function setArrayValue(form: FormInstance, atoms: FieldAtoms, value: any[]) {
  const itemSchema = getItemSchema(atoms);
  if (!itemSchema) return;

  startBatch();
  const fieldsMap = form.fields();
  const currentRows = atoms.arrayRows();

  // Remove excess rows
  for (let i = currentRows - 1; i >= value.length; i--) {
    const prefix = `${atoms.path}.${i}`;
    for (const key of Array.from(fieldsMap.keys())) {
      if (key === prefix || key.startsWith(`${prefix}.`)) fieldsMap.delete(key);
    }
  }

  // Create/update rows
  for (let i = 0; i < value.length; i++) {
    if (i >= currentRows) {
      createRowFields(form, atoms, i, value[i]);
    } else if (itemSchema.properties) {
      for (const key of Object.keys(itemSchema.properties)) {
        const field = fieldsMap.get(`${atoms.path}.${i}.${key}`);
        if (field) field.setValue(value[i]?.[key]);
      }
    }
  }

  atoms.arrayRows(value.length);
  atoms.value(value);
  form.fields(new Map(fieldsMap));
  endBatch();
}

function resetArrayRows(form: FormInstance, atoms: FieldAtoms, initialValue: any) {
  setArrayValue(form, atoms, Array.isArray(initialValue) ? initialValue : []);
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
        values: form.values(),
        deps: scope.$dependencies || {},
        dependencies: scope.$dependencies || {},
        scope,
        key,
        rule,
        value: scope.$value,
        kind: "x-reaction",
      });
    }
  }
}

/**
 * Resolve dependencies for a reaction rule.
 *
 * IMPORTANT: When called inside an effect, we must ONLY track the dependency
 * field value signals — not the fieldsSignal itself. Reading fieldsSignal()
 * inside an effect causes the effect to re-run on ANY field registry change
 * (add/remove), which is both wasteful and can interfere with proper dep tracking.
 *
 * We accept the fieldsMap as a parameter so the caller controls whether
 * fieldsSignal is tracked or not.
 */
function resolveDeps(fieldsMap: Map<string, FieldAtoms>, dependencies: string[] | Record<string, string> | undefined, selfPath: string) {
  const deps: Record<string, any> = {};
  const depsArray: any[] = [];
  if (!dependencies) return { deps, depsArray };

  if (Array.isArray(dependencies)) {
    for (const depPath of dependencies) {
      const resolved = resolveFieldPath(depPath, selfPath);
      const depField = fieldsMap.get(resolved);
      // Reading depField.value() inside an effect TRACKS this signal
      const value = depField ? depField.value() : undefined;
      depsArray.push(value);
      deps[depPath] = value;
    }
  } else {
    for (const [alias, depPath] of Object.entries(dependencies)) {
      const resolved = resolveFieldPath(depPath, selfPath);
      const depField = fieldsMap.get(resolved);
      deps[alias] = depField ? depField.value() : undefined;
    }
  }
  return { deps, depsArray };
}

function buildScope(form: FormInstance, fieldAtoms: FieldAtoms, deps: Record<string, any>, depsArray: any[]): Record<string, any> {
  const config = (form as any)._config as FormConfig;
  return {
    $self: fieldAtoms,
    $form: form,
    // Lazy getters: avoid tracking form.values() and fieldAtoms.value()
    // inside the reaction effect unless they are actually accessed by the rule.
    get $values() { return form.values(); },
    $deps: depsArray.length > 0 ? depsArray : deps,
    $dependencies: deps,
    get $value() { return fieldAtoms.value(); },
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

async function runXValidate(form: FormInstance, fieldAtoms: FieldAtoms, rules: SchemaXValidate, value: any): Promise<FieldError[]> {
  const ruleList = Array.isArray(rules) ? rules : [rules];
  const errors: FieldError[] = [];
  const config = (form as any)._config as FormConfig;
  const fieldsMap = form.fields();

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

// ─── Schema → Field Tree Creation ───────────────────────────────────────────

function createFieldTree(
  form: FormInstance,
  path: string,
  rawSchema: IFieldSchema,
  initialValue?: any,
  parentRequired?: boolean | string[],
): void {
  const definitions = (form as any)._definitions as Record<string, IFieldSchema>;
  const schema = resolveSchemaTree(rawSchema, definitions, (ref, msg) => {
    emitError(form, { scope: "ref-resolve", path: "", message: msg });
  });

  const parts = path.split(".");
  const key = parts[parts.length - 1] || path;
  const isRequired = schema.required === true || (Array.isArray(parentRequired) && parentRequired.includes(key));
  const mergedSchema = { ...schema, required: isRequired };

  if (schema.type === "array" && schema.items && !Array.isArray(schema.items)) {
    const iv = initialValue !== undefined ? initialValue : getDeepValue((form as any)._initialValues, path);
    const atoms = form.createField(path, mergedSchema, iv);
    // Create initial rows
    if (Array.isArray(iv) && schema.items.properties) {
      const itemSchema = schema.items as IFieldSchema;
      for (let i = 0; i < iv.length; i++) {
        const sorted = sortByOrder(itemSchema.properties!);
        for (const [childKey, childSchema] of sorted) {
          createFieldTree(form, `${path}.${i}.${childKey}`, childSchema, iv[i]?.[childKey], itemSchema.required);
        }
      }
    }
    return;
  }

  if (schema.type === "object" && schema.properties) {
    if (schema.component) {
      form.createField(path, mergedSchema, initialValue);
    }
    const sorted = sortByOrder(schema.properties);
    for (const [childKey, childSchema] of sorted) {
      const childIv = initialValue != null ? initialValue[childKey] : getDeepValue((form as any)._initialValues, `${path}.${childKey}`);
      createFieldTree(form, `${path}.${childKey}`, childSchema, childIv, schema.required);
    }
    return;
  }

  if (schema.type === "void") {
    const preserveOwnPath = !!rawSchema.$ref;
    const childPrefix = preserveOwnPath ? path : (path.includes(".") ? path.slice(0, path.lastIndexOf(".")) : "");
    if (schema.component) {
      form.createField(path, mergedSchema, initialValue);
    }
    if (schema.properties) {
      const sorted = sortByOrder(schema.properties);
      for (const [childKey, childSchema] of sorted) {
        const childPath = childPrefix ? `${childPrefix}.${childKey}` : childKey;
        createFieldTree(form, childPath, childSchema, undefined, schema.required);
      }
    }
    return;
  }

  const iv = initialValue !== undefined ? initialValue : getDeepValue((form as any)._initialValues, path);
  form.createField(path, mergedSchema, iv);
}

// ─── Reaction Effect Installation ───────────────────────────────────────────

function installReactions(form: FormInstance): () => void {
  const disposers: (() => void)[] = [];
  const fieldsMap = form.fields();

  for (const [path, fieldAtoms] of fieldsMap) {
    const reactions = fieldAtoms.schema["x-reaction"];
    if (!reactions) continue;

    for (const [reactionKey, ruleOrRules] of Object.entries(reactions)) {
      if (!ruleOrRules) continue;
      const rules = Array.isArray(ruleOrRules) ? ruleOrRules : [ruleOrRules];

      for (const rule of rules) {
        // Determine if this rule has explicit dependencies
        const hasDeps = rule.dependencies && (
          (Array.isArray(rule.dependencies) && rule.dependencies.length > 0) ||
          (!Array.isArray(rule.dependencies) && Object.keys(rule.dependencies).length > 0)
        );

        const dispose = effect(() => {
          // Read the fieldsMap OUTSIDE the signal tracking path.
          // We snapshot the current fields map directly — we do NOT want to
          // track fieldsSignal here because that would re-trigger this effect
          // on every field add/remove (e.g. array push/remove).
          const currentFieldsMap = (form as any)._fieldsMap as Map<string, FieldAtoms>;

          // Track ONLY the dependency field value signals
          const { deps, depsArray } = resolveDeps(currentFieldsMap, rule.dependencies, path);

          // If no explicit dependencies declared, track self value as implicit dep
          // so static/expression rules without deps still run on init
          if (!hasDeps) {
            void fieldAtoms.value();
          }

          const scope = buildScope(form, fieldAtoms, deps, depsArray);
          const result = resolveXRuleValue(form, fieldAtoms, reactionKey, rule, scope);

          if (result && typeof result === "object" && typeof result.then === "function") {
            // Async reaction
            result.then((resolved: any) => applyReactionValue(fieldAtoms, reactionKey, resolved))
              .catch((err: any) => emitError(form, {
                scope: "x-reaction", path, key: reactionKey,
                message: err instanceof Error ? err.message : String(err), cause: err,
              }));
          } else {
            applyReactionValue(fieldAtoms, reactionKey, result);
          }
        });
        disposers.push(dispose);
      }
    }
  }

  return () => { for (const d of disposers) d(); };
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
  const fieldsSignal = signal(new Map<string, FieldAtoms>());
  // Plain mutable ref to the current fields Map — used by reaction effects
  // to read the Map WITHOUT tracking fieldsSignal (avoids re-triggering
  // all reactions on every field add/remove).
  let fieldsMapRef = fieldsSignal();
  const submittingSignal = signal(false);
  const errorListeners = new Set<(e: FormError) => void>(config.onError ? [config.onError] : []);
  let destroyed = false;
  let reactionDispose: (() => void) | null = null;
  let setupDispose: (() => void) | null = null;
  let initialValues = config.initialValues ? { ...config.initialValues } : {};
  let definitions: Record<string, IFieldSchema> = {};
  const effectDisposers = new Set<() => void>();

  const valuesComputed = computed(() => {
    const result: Record<string, any> = {};
    const fieldsMap = fieldsSignal();
    for (const [path, atoms] of fieldsMap) {
      if (atoms.display() === "none") continue;
      if (atoms.isArrayField) {
        // Collect array value from child fields
        const itemSchema = getItemSchema(atoms);
        if (itemSchema?.properties) {
          const rows: any[] = [];
          const rowCount = atoms.arrayRows();
          for (let i = 0; i < rowCount; i++) {
            const row: Record<string, any> = {};
            for (const key of Object.keys(itemSchema.properties)) {
              const childField = fieldsMap.get(`${path}.${i}.${key}`);
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
      // Skip array child fields (handled by parent)
      if (isArrayChildPath(fieldsMap, path)) continue;
      // Skip void fields with component
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

  const form: FormInstance = {
    fields: fieldsSignal,
    submitting: submittingSignal,
    values: valuesComputed,
    errors: errorsComputed,
    valid: validComputed,

    field(path: string) {
      return fieldsSignal().get(path);
    },

    createField(path: string, schema: IFieldSchema, initialValue?: any) {
      const atoms = createFieldAtoms(form, path, schema, initialValue);
      const map = fieldsSignal();
      map.set(path, atoms);
      const newMap = new Map(map);
      fieldsMapRef = newMap;
      fieldsSignal(newMap);
      return atoms;
    },

    setSchema(schema: IFormSchema) {
      startBatch();
      if (reactionDispose) { reactionDispose(); reactionDispose = null; }
      definitions = schema.definitions || {};
      const emptyMap = new Map<string, FieldAtoms>();
      fieldsMapRef = emptyMap;
      fieldsSignal(emptyMap);

      if (schema.properties) {
        const sorted = sortByOrder(schema.properties);
        for (const [key, fieldSchema] of sorted) {
          createFieldTree(form, key, fieldSchema, undefined, schema.required);
        }
      }

      reactionDispose = installReactions(form);
      endBatch();
    },

    setValues(values: Record<string, any>) {
      if (!values || typeof values !== "object") return;
      startBatch();
      const fieldsMap = fieldsSignal();
      // Sort: array fields first
      const entries = Array.from(fieldsMap.entries()).sort(([, a], [, b]) => {
        if (a.isArrayField !== b.isArrayField) return a.isArrayField ? -1 : 1;
        return 0;
      });
      for (const [path, atoms] of entries) {
        if (isArrayChildPath(fieldsMap, path)) continue;
        const value = getDeepValue(values, path);
        if (value !== undefined) atoms.setValue(value);
      }
      endBatch();
    },

    setInitialValues(values: Record<string, any>) {
      initialValues = { ...values };
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
          error.messages = form.errors().map((e) => e.message);
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
      if (reactionDispose) reactionDispose();
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
        // Simple effect
        const dispose = effect(() => {
          if (destroyed) return;
          return (runnerOrSelector as (form: FormInstance) => void | (() => void))(form);
        });
        effectDisposers.add(dispose);
        return () => { dispose(); effectDisposers.delete(dispose); };
      }

      // Selector + listener effect
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
  };

  // Attach internal state
  (form as any)._config = config;
  (form as any)._errorListeners = errorListeners;
  (form as any)._definitions = definitions;
  (form as any)._initialValues = initialValues;

  // Override form.fields with a wrapper that keeps fieldsMapRef in sync.
  // Reading (no args) still tracks fieldsSignal normally.
  // Writing (with args) also updates the plain fieldsMapRef.
  const originalFields = form.fields;
  (form as any).fields = ((...args: any[]) => {
    if (args.length === 0) {
      return originalFields();
    }
    const newMap = args[0] as Map<string, FieldAtoms>;
    fieldsMapRef = newMap;
    return (originalFields as any)(newMap);
  }) as typeof fieldsSignal;

  // Expose a getter for reaction effects to read without signal tracking
  Object.defineProperty(form, '_fieldsMap', {
    get() { return fieldsMapRef; },
    enumerable: false,
  });

  // Run setup
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
