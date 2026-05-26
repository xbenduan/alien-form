import { computed, effect, endBatch, startBatch } from "alien-signals";
import { createField, getFieldInternals } from "../field/index";
import { normalizeValidationErrors } from "../field/validation";
import { buildValueScope, resolveDependencies, resolveXRuleValue, runXRuleListSync, type RuleRuntimeHost } from "../runtime/reaction";
import { disposeSchemaRuleEffects, installSchemaRuleEffects } from "../runtime/rule-effect";
import type {
  EffectContext,
  EffectOptions,
  FieldError,
  FieldMutableState,
  FormConfig,
  FormError,
  IField,
  IFieldSchema,
  IForm,
  IFormSchema,
  SchemaXValidate,
} from "../../schema/types";
import { getDeepValue, isVoidField, setDeepValue, sortByOrder } from "../../schema/path";
import { readUntracked } from "../../utils";
import type { FormInternals } from "./internals";

// ─── Internal helpers ────────────────────────────────────────────────────────

function invalidateComputed(internals: FormInternals): void {
  internals.version(internals.version() + 1);
}

/**
 * Determine if a path is a child of an array field.
 * Uses a Set of known array field paths for O(depth) lookup instead of
 * iterating all fields.
 */
function isArrayChildPath(arrayFieldPaths: Set<string>, path: string): boolean {
  const parts = path.split(".");
  for (let i = 1; i < parts.length; i++) {
    const parentPath = parts.slice(0, i).join(".");
    if (arrayFieldPaths.has(parentPath)) return true;
  }
  return false;
}

/** Build a set of all array field paths for fast child-path lookups. */
function getArrayFieldPaths(fields: Map<string, IField>): Set<string> {
  const set = new Set<string>();
  for (const [path, field] of fields) {
    if (field.isArrayField) set.add(path);
  }
  return set;
}

function collectFormValues(form: InternalForm, mode: "output" | "raw"): Record<string, any> {
  const internals = form._getInternals();
  const result: Record<string, any> = {};
  const arrayPaths = getArrayFieldPaths(internals.fields);

  for (const [path, field] of internals.fields) {
    if (!field.visible) continue;
    if (isArrayChildPath(arrayPaths, path)) continue;
    if (field.component && isVoidField(path, internals.schema)) continue;
    setDeepValue(
      result,
      path,
      mode === "output" ? formatFieldValue(form, path, field.value, "output") : field.value,
    );
  }
  return result;
}

function bumpFieldRegistryVersion(form: InternalForm): void {
  const internals = form._getInternals();
  internals.fieldRegistryVersion(internals.fieldRegistryVersion() + 1);
}

function beginFieldLoading(form: InternalForm, field: IField): void {
  const internals = form._getInternals();
  const nextCount = (internals.fieldLoadingCounts.get(field.path) || 0) + 1;
  internals.fieldLoadingCounts.set(field.path, nextCount);
  if (nextCount === 1) field.setLoading(true);
}

function endFieldLoading(form: InternalForm, field: IField): void {
  const internals = form._getInternals();
  const currentCount = internals.fieldLoadingCounts.get(field.path) || 0;
  if (currentCount <= 1) {
    internals.fieldLoadingCounts.delete(field.path);
    field.setLoading(false);
    return;
  }
  internals.fieldLoadingCounts.set(field.path, currentCount - 1);
}

function emitError(form: InternalForm, error: FormError): void {
  const internals = form._getInternals();
  if (internals.errorListeners.size === 0) {
    console.warn(
      `[alien-form] [${error.scope}${error.key ? ":" + error.key : ""}] ${error.path || "<form>"}: ${error.message}`,
      error.cause ?? "",
    );
    return;
  }

  for (const listener of internals.errorListeners) {
    try {
      listener(error);
    } catch (listenerError) {
      console.error("[alien-form] onError listener threw:", listenerError);
    }
  }
}

function resolveRef(form: InternalForm, schema: IFieldSchema, seen: Set<string> = new Set()): IFieldSchema {
  const internals = form._getInternals();
  if (!schema.$ref) return schema;

  const refPath = schema.$ref.replace(/^#\/definitions\//, "");
  if (seen.has(refPath)) {
    emitError(form, {
      scope: "ref-resolve",
      path: "",
      message: `Circular $ref detected: ${schema.$ref} (chain: ${Array.from(seen).join(" -> ")} -> ${refPath})`,
    });
    const { $ref: _ignored, ...localProps } = schema;
    void _ignored;
    return localProps as IFieldSchema;
  }

  const resolved = internals.definitions[refPath];
  if (!resolved) {
    emitError(form, {
      scope: "ref-resolve",
      path: "",
      message: `Could not resolve $ref: ${schema.$ref}`,
    });
    return schema;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(refPath);
  const localProps = { ...schema };
  delete localProps.$ref;
  return { ...resolveRef(form, resolved, nextSeen), ...localProps };
}

function getRuleRuntimeHost(form: InternalForm): RuleRuntimeHost {
  const internals = form._getInternals();
  return {
    form,
    scope: internals.scope,
    handlers: internals.config.handlers,
    fields: internals.fields,
    getField: (path) => form.getField(path),
    getValuesSnapshot: () => form._valuesSnapshot(),
    getRawValuesSnapshot: () => form._rawValues(),
    beginFieldLoading: (field) => beginFieldLoading(form, field),
    endFieldLoading: (field) => endFieldLoading(form, field),
    emitError: (error) => emitError(form, error),
  };
}

function formatInitialValue(form: InternalForm, path: string, schema: IFieldSchema, value: any): any {
  const internals = form._getInternals();
  const format = schema["x-format"];
  if (format) internals.fieldFormats.set(path, format);
  if (!format?.input || value === undefined) return value;
  const host = getRuleRuntimeHost(form);
  return runXRuleListSync(host, undefined, "input", format.input, buildValueScope(host, value), "x-format", value);
}

function formatFieldValue(
  form: InternalForm,
  path: string,
  value: any,
  direction: "input" | "output",
): any {
  const internals = form._getInternals();
  if (internals.formattingValuePaths.has(path)) return value;
  const format = internals.fieldFormats.get(path);
  const rules = format?.[direction];
  if (!rules || value === undefined) return value;

  const host = getRuleRuntimeHost(form);
  const field = internals.fields.get(path);
  internals.formattingValuePaths.add(path);
  try {
    return runXRuleListSync(
      host,
      field,
      direction,
      rules,
      buildValueScope(host, value, field),
      "x-format",
      value,
    );
  } finally {
    internals.formattingValuePaths.delete(path);
  }
}

function createFieldsFromSchema(
  form: InternalForm,
  prefix: string,
  properties: Record<string, IFieldSchema>,
  parentRequired?: boolean | string[],
  scopeValue?: Record<string, any>,
): void {
  const sortedEntries = Object.entries(properties).sort(([, a], [, b]) => (a.order ?? Infinity) - (b.order ?? Infinity));

  for (const [key, rawSchema] of sortedEntries) {
    const path = prefix ? `${prefix}.${key}` : key;
    const initialValue =
      scopeValue && typeof scopeValue === "object" ? scopeValue[key] : getDeepValue(form._getInternals().initialValues, path);
    form._createFieldTree(path, rawSchema, initialValue, parentRequired);
  }
}

function createFieldTree(
  form: InternalForm,
  path: string,
  rawSchema: IFieldSchema,
  initialValue?: any,
  parentRequired?: boolean | string[],
): void {
  const schema = resolveRef(form, rawSchema);
  const parts = path.split(".");
  const key = parts[parts.length - 1] || path;
  const isRequired =
    schema.required === true || (Array.isArray(parentRequired) && parentRequired.includes(key));

  if (schema.type === "array" && schema.items) {
    const itemSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    form.createField(path, { ...schema, required: isRequired }, initialValue);
    if (itemSchema && typeof itemSchema === "object" && Array.isArray(initialValue)) {
      if ((itemSchema as IFieldSchema).properties) {
        const itemProperties = (itemSchema as IFieldSchema).properties!;
        const sortedEntries = Object.entries(itemProperties).sort(([, a], [, b]) => (a.order ?? Infinity) - (b.order ?? Infinity));
        for (let index = 0; index < initialValue.length; index++) {
          for (const [childKey, childSchema] of sortedEntries) {
            createFieldTree(
              form,
              `${path}.${index}.${childKey}`,
              childSchema as IFieldSchema,
              initialValue[index]?.[childKey],
              (itemSchema as IFieldSchema).required,
            );
          }
        }
      } else {
        for (let index = 0; index < initialValue.length; index++) {
          createFieldTree(form, `${path}.${index}`, itemSchema as IFieldSchema, initialValue[index]);
        }
      }
    }
    return;
  }

  if (schema.type === "object" && schema.properties) {
    if (schema.component) {
      form.createField(path, { ...schema, required: isRequired }, initialValue);
    }
    createFieldsFromSchema(form, path, schema.properties, schema.required, initialValue);
    return;
  }

  if (schema.type === "void") {
    if (schema.component) {
      form.createField(path, { ...schema, required: false }, initialValue);
    }
    if (schema.properties) {
      createFieldsFromSchema(form, path, schema.properties, schema.required, initialValue);
    }
    return;
  }

  form.createField(path, { ...schema, required: isRequired }, initialValue);
}

// ─── Public / Runtime method interfaces ──────────────────────────────────────

export interface FormPublicMethods {
  createField(path: string, schema: IFieldSchema, initialValue?: any): IField;
  getField(path: string): IField | undefined;
  setFieldState(path: string, setter: (state: Partial<FieldMutableState>) => void): void;
  setValues(values: Record<string, any>): void;
  setInitialValues(values: Record<string, any>): void;
  reset(): void;
  validate(): Promise<boolean>;
  submit<T = any>(onSubmit?: (values: Record<string, any>) => T | Promise<T>): Promise<T>;
  destroy(): void;
  subscribe(listener: () => void): () => void;
  effect(runner: (form: IForm, ctx: EffectContext) => void | (() => void)): () => void;
  effect<T>(
    selector: (form: IForm) => T,
    listener: (value: T, prevValue: T | undefined, ctx: EffectContext) => void,
    options?: EffectOptions<T>,
  ): () => void;
  setSchema(schema: IFormSchema): void;
  getArrayField(path: string): IField | undefined;
  removeArrayItem(arrayPath: string, index: number): void;
  onError(listener: (error: FormError) => void): () => void;
}

export interface FormRuntimeMethods {
  _getInternals(): FormInternals;
  _emitError(error: FormError): void;
  _notifyFieldChange(path: string, field: IField): void;
  _notifyFieldValueChange(path: string, field: IField): void;
  _notifyFieldStructureChange(): void;
  _notifyFieldValidateStart(path: string, field: IField): void;
  _notifyFieldValidateEnd(path: string, field: IField): void;
  _notifyFieldValidateFailed(path: string, field: IField): void;
  _notifyFieldValidateSuccess(path: string, field: IField): void;
  _createFieldTree(
    path: string,
    rawSchema: IFieldSchema,
    initialValue?: any,
    parentRequired?: boolean | string[],
  ): void;
  _runXValidate(field: IField, rules: SchemaXValidate, value: any): Promise<FieldError[]>;
  _rawValues(): Record<string, any>;
  _valuesSnapshot(): Record<string, any>;
}

export type InternalForm = IForm & FormRuntimeMethods;

// ─── Effect disposer tracking ────────────────────────────────────────────────

const formEffectDisposers = new WeakMap<FormInternals, Set<() => void>>();

function getEffectDisposers(internals: FormInternals): Set<() => void> {
  let set = formEffectDisposers.get(internals);
  if (!set) {
    set = new Set();
    formEffectDisposers.set(internals, set);
  }
  return set;
}

export function trackDispose(internals: FormInternals, dispose: () => void): () => void {
  const disposers = getEffectDisposers(internals);
  let disposed = false;
  const trackedDispose = () => {
    if (disposed) return;
    disposed = true;
    disposers.delete(trackedDispose);
    dispose();
  };
  disposers.add(trackedDispose);
  return trackedDispose;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createFormMethods(
  form: InternalForm,
  internals: FormInternals,
): { publicMethods: FormPublicMethods; runtimeMethods: FormRuntimeMethods } {
  // Setup computed values using alien-signals computed()
  internals.valuesComputed = computed(() => {
    internals.fieldRegistryVersion();
    internals.version();
    return readUntracked(() => collectFormValues(form, "output"));
  });

  internals.rawValuesComputed = computed(() => {
    internals.fieldRegistryVersion();
    internals.version();
    return readUntracked(() => collectFormValues(form, "raw"));
  });

  const runtimeMethods: FormRuntimeMethods = {
    _getInternals() {
      return internals;
    },
    _emitError(error) {
      emitError(form, error);
    },
    _notifyFieldChange(_path, _field) {
      invalidateComputed(internals);
    },
    _notifyFieldValueChange(_path, _field) {
      invalidateComputed(internals);
    },
    _notifyFieldStructureChange() {
      bumpFieldRegistryVersion(form);
    },
    _notifyFieldValidateStart(_path, _field) {},
    _notifyFieldValidateEnd(_path, _field) {},
    _notifyFieldValidateFailed(_path, _field) {},
    _notifyFieldValidateSuccess(_path, _field) {},
    _createFieldTree(path, rawSchema, initialValue, parentRequired) {
      createFieldTree(form, path, rawSchema, initialValue, parentRequired);
    },
    async _runXValidate(field, rules, value) {
      const ruleList = Array.isArray(rules) ? rules : [rules];
      const host = getRuleRuntimeHost(form);
      const errors: FieldError[] = [];

      for (const rule of ruleList) {
        const { deps, depsArray } = resolveDependencies(host, rule.dependencies, field.path);
        const resolved = await resolveXRuleValue(
          host,
          field,
          "validate",
          rule,
          {
            ...buildValueScope(host, value, field),
            $deps: depsArray.length > 0 ? depsArray : deps,
            $dependencies: deps,
          },
          "x-validate",
        );
        errors.push(...normalizeValidationErrors(resolved));
      }

      return errors;
    },
    _rawValues() {
      return internals.rawValuesComputed!();
    },
    _valuesSnapshot() {
      return internals.valuesComputed!();
    },
  };

  const publicMethods: FormPublicMethods = {
    createField(path, schema, initialValue) {
      const rawInitialValue = initialValue !== undefined ? initialValue : getDeepValue(internals.initialValues, path);
      const sourceInitialValue = rawInitialValue !== undefined ? rawInitialValue : schema.default;
      const formattedInitialValue = formatInitialValue(form, path, schema, sourceInitialValue);
      const fieldSchema =
        rawInitialValue === undefined && schema.default !== undefined ? { ...schema, default: undefined } : schema;
      const field = createField(path, fieldSchema, formattedInitialValue);
      getFieldInternals(field).runtime.connectForm(form as any);
      internals.fields.set(path, field);
      bumpFieldRegistryVersion(form);
      invalidateComputed(internals);
      return field;
    },
    getField(path) {
      internals.fieldRegistryVersion();
      return internals.fields.get(path);
    },
    setFieldState(path, setter) {
      const field = form.getField(path);
      if (!field) return;
      const state: Partial<FieldMutableState> = {};
      setter(state);
      field.setState(state);
      invalidateComputed(internals);
    },
    setValues(values) {
      if (values === undefined || values === null || typeof values !== "object") return;

      startBatch();
      try {
        // Sort: array fields first (by path length ascending) so parent arrays
        // are populated before their children are iterated.
        const entries = Array.from(internals.fields.entries()).sort(([pathA, fieldA], [pathB, fieldB]) => {
          if (fieldA.isArrayField !== fieldB.isArrayField) return fieldA.isArrayField ? -1 : 1;
          return pathA.length - pathB.length;
        });

        const arrayPaths = getArrayFieldPaths(internals.fields);
        for (const [path, field] of entries) {
          if (isArrayChildPath(arrayPaths, path)) continue;
          const value = getDeepValue(values, path);
          if (value !== undefined) field.setValue(formatFieldValue(form, path, value, "input"));
        }
      } finally {
        endBatch();
      }
    },
    setInitialValues(values) {
      internals.initialValues = { ...values };
    },
    reset() {
      startBatch();
      try {
        for (const field of internals.fields.values()) field.reset();
      } finally {
        endBatch();
      }
    },
    async validate() {
      const results = await Promise.all(
        Array.from(internals.fields.values())
          .filter((field) => field.visible)
          .map((field) => field.validate()),
      );
      return results.every((errors) => errors.length === 0);
    },
    async submit<T = any>(onSubmit?: (values: Record<string, any>) => T | Promise<T>) {
      internals.submitting(true);
      try {
        const isValid = await form.validate();
        if (!isValid) {
          const error: any = new Error("Validation failed");
          error.messages = form.errors.map((item) => item.message);
          throw error;
        }
        return onSubmit ? await onSubmit(form.values) : (form.values as T);
      } finally {
        internals.submitting(false);
      }
    },
    destroy() {
      if (internals.destroyed) return;
      internals.destroyed = true;

      const disposers = getEffectDisposers(internals);
      for (const dispose of Array.from(disposers)) {
        try { dispose(); } catch (e) { console.error("[alien-form] destroy disposer threw:", e); }
      }
      disposers.clear();

      if (internals.scopeDispose) {
        internals.scopeDispose();
        internals.scopeDispose = null;
      }

      disposeSchemaRuleEffects(form);
      internals.errorListeners.clear();
    },
    subscribe(listener) {
      return effect(() => {
        internals.version();
        internals.fieldRegistryVersion();
        listener();
      });
    },
    effect<T>(
      runnerOrSelector:
        | ((form: IForm, ctx: EffectContext) => void | (() => void))
        | ((form: IForm) => T),
      listener?: (value: T, prevValue: T | undefined, ctx: EffectContext) => void,
      options?: EffectOptions<T>,
    ): () => void {
      const disposers = getEffectDisposers(internals);

      if (!listener) {
        let stopped = false;
        let effectDispose: (() => void) | null = null;
        const stop = () => {
          if (stopped) return;
          stopped = true;
          effectDispose?.();
          disposers.delete(stop);
        };
        const ctx: EffectContext = { form, stop };
        effectDispose = effect(() => {
          if (internals.destroyed || stopped) return;
          return (runnerOrSelector as (form: IForm, ctx: EffectContext) => void | (() => void))(form, ctx);
        });
        disposers.add(stop);
        return stop;
      }

      const equals = options?.equals ?? Object.is;
      const immediate = options?.immediate ?? false;
      let initialized = false;
      let stopped = false;
      let previousValue: T | undefined;
      let effectDispose: (() => void) | null = null;

      const stop = () => {
        if (stopped) return;
        stopped = true;
        effectDispose?.();
        disposers.delete(stop);
      };

      const ctx: EffectContext = { form, stop };
      effectDispose = effect(() => {
        if (internals.destroyed || stopped) return;
        const nextValue = (runnerOrSelector as (form: IForm) => T)(form);
        if (!initialized) {
          initialized = true;
          if (immediate) {
            listener(nextValue, previousValue, ctx);
            if (stopped) return;
          }
          previousValue = nextValue;
          return;
        }

        if (equals(previousValue as T, nextValue)) return;
        const lastValue = previousValue;
        previousValue = nextValue;
        listener(nextValue, lastValue, ctx);
      });

      disposers.add(stop);
      return stop;
    },
    setSchema(schema) {
      startBatch();
      try {
        internals.schema = schema;
        disposeSchemaRuleEffects(form);
        internals.fieldFormats.clear();
        internals.fields.clear();
        internals.definitions = schema.definitions || {};
        bumpFieldRegistryVersion(form);

        if (schema.properties) {
          createFieldsFromSchema(form, "", sortByOrder(schema.properties), schema.required);
        }
        installSchemaRuleEffects(form);
        invalidateComputed(internals);
      } finally {
        endBatch();
      }
    },
    getArrayField(path) {
      const field = form.getField(path);
      return field?.isArrayField ? field : undefined;
    },
    removeArrayItem(arrayPath, index) {
      form.getArrayField(arrayPath)?.remove(index);
    },
    onError(listener) {
      internals.errorListeners.add(listener);
      return () => {
        internals.errorListeners.delete(listener);
      };
    },
  };

  return { publicMethods, runtimeMethods };
}
