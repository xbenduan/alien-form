/**
 * @alien-form/core — Form model implementation
 * Enterprise schema protocol inspired by Formily
 */

import { signal, effect, startBatch, endBatch } from "alien-signals";
import { Field } from "../field/index";
import { NotificationScheduler } from "./notification";
import {
  applyReactionValue,
  buildReactionScope,
  buildValueScope,
  resolveDependencies,
  resolveFieldPath,
  resolveXRuleValue,
  runXRuleListSync,
  type RuleRuntimeHost,
} from "../runtime/reaction";
import type {
  IForm,
  IField,
  FieldError,
  IFormSchema,
  IFieldSchema,
  FormConfig,
  SchemaXRule,
  SchemaFormat,
  SchemaXValidate,
  FieldMutableState,
  FormError,
  EffectOptions,
  EffectContext,
} from "../types";

import { getDeepValue, setDeepValue, sortByOrder, isVoidField } from "../utils/path";
import { normalizeValidationErrors } from "../field/validation";
import { isPromiseLike } from "../utils/type";

const MAX_REACTION_RUNS_PER_FLUSH = 20;

// ============================================================
// Form class
// ============================================================

export class Form implements IForm {
  fields: Map<string, IField> = new Map();
  private _initialValues: Record<string, any>;
  private _submitting: ReturnType<typeof signal<boolean>>;
  private _version: ReturnType<typeof signal<number>>;
  private _errorListeners: Set<(error: FormError) => void> = new Set();
  private _schema: IFormSchema | null = null;
  private _reactionDisposers: Array<() => void> = [];
  private _reactionValueTriggers: Map<string, Set<() => void>> = new Map();
  private _reactionRunners: Array<() => void> = [];
  private _actionCache: Map<string, string> = new Map();
  private _fieldFormats: Map<string, SchemaFormat> = new Map();
  private _formattingValuePaths: Set<string> = new Set();
  private _config: FormConfig;
  private _scope: Record<string, any>;
  private _definitions: Record<string, IFieldSchema> = {};
  private _valuesCache: Record<string, any> | null = null;
  private _rawValuesCache: Record<string, any> | null = null;
  private _asyncReactionVersions: Map<string, number> = new Map();
  private _fieldLoadingCounts: Map<string, number> = new Map();
  private _notifications: NotificationScheduler;
  private _ruleRuntime: RuleRuntimeHost;
  private _reactionRunCounts: Map<string, number> = new Map();
  private _reactionRunDepth = 0;
  private _reactionRunnerSeq = 0;
  private _effectDisposers: Set<() => void> = new Set();
  private _fieldRegistryVersion: ReturnType<typeof signal<number>>;
  private _destroyed = false;

  constructor(config: FormConfig = {}) {
    this._config = config;
    this._initialValues = config.initialValues ? { ...config.initialValues } : {};
    this._submitting = signal(false);
    this._version = signal(0);
    this._fieldRegistryVersion = signal(0);
    this._scope = config.scope || {};
    this._ruleRuntime = {
      form: this,
      scope: this._scope,
      handlers: this._config.handlers,
      fields: this.fields,
      rawValues: () => this._rawValues(),
      beginFieldLoading: (field) => this._beginFieldLoading(field),
      endFieldLoading: (field) => this._endFieldLoading(field),
      emitError: (error) => this._emitError(error),
    };
    this._notifications = new NotificationScheduler({
      runReactionTriggers: (path) => this._runReactionValueTriggers(path),
      beforeFlush: () => this._reactionRunCounts.clear(),
      afterFlush: () => this._reactionRunCounts.clear(),
      commitVersionChange: () => this._commitVersionChange(),
    });

    if (config.onError) {
      this._errorListeners.add(config.onError);
    }

    if (config.setup) {
      const dispose = config.setup(this);
      if (typeof dispose === "function") {
        this._trackDispose(dispose);
      }
    }
  }

  // ============================================================
  // Computed properties
  // ============================================================

  get values(): Record<string, any> {
    this._fieldRegistryVersion();
    this._version();
    if (this._valuesCache !== null) return this._valuesCache;
    const result: Record<string, any> = {};
    for (const [path, field] of this.fields) {
      if (!field.visible) continue;
      // Skip array child fields — they are part of the array field's value
      if (this._isArrayChildPath(path)) continue;
      // Skip void fields — they are layout containers
      if (field.component && isVoidField(path, this._schema)) continue;
      setDeepValue(result, path, this._formatFieldValue(path, field.value, "output"));
    }
    this._valuesCache = result;
    return result;
  }

  get initialValues(): Record<string, any> {
    return this._initialValues;
  }

  get valid(): boolean {
    for (const [, field] of this.fields) {
      if (field.visible && field.errors.length > 0) return false;
    }
    return true;
  }

  get invalid(): boolean {
    return !this.valid;
  }

  get submitting(): boolean {
    return this._submitting();
  }

  get errors(): FieldError[] {
    const allErrors: FieldError[] = [];
    for (const [, field] of this.fields) {
      if (field.visible) allErrors.push(...field.errors);
    }
    return allErrors;
  }

  // ============================================================
  // Field creation & access
  // ============================================================

  createField(path: string, schema: IFieldSchema, initialValue?: any): IField {
    const rawInitVal =
      initialValue !== undefined ? initialValue : getDeepValue(this._initialValues, path);
    const sourceInitVal = rawInitVal !== undefined ? rawInitVal : schema.default;
    const initVal = this._formatInitialValue(path, schema, sourceInitVal);
    const fieldSchema =
      rawInitVal === undefined && schema.default !== undefined
        ? { ...schema, default: undefined }
        : schema;
    const field = new Field(path, fieldSchema, initVal);
    (field as Field)._setForm(this);
    this.fields.set(path, field);
    this._bumpFieldRegistryVersion();
    this._bumpVersion();

    return field;
  }

  getField(path: string): IField | undefined {
    this._fieldRegistryVersion();
    return this.fields.get(path);
  }

  setFieldState(path: string, setter: (state: Partial<FieldMutableState>) => void): void {
    const field = this.fields.get(path);
    if (!field) return;
    const state: Partial<FieldMutableState> = {};
    setter(state);
    field.setState(state);
    this._bumpVersion();
  }

  getArrayField(path: string): IField | undefined {
    const field = this.fields.get(path);
    if (field && field.isArrayField) return field;
    return undefined;
  }

  removeArrayItem(arrayPath: string, index: number): void {
    const field = this.getArrayField(arrayPath);
    if (field) {
      field.remove(index);
      this._bumpVersion();
    }
  }

  // ============================================================
  // Value operations
  // ============================================================

  setValues(values: Record<string, any>): void {
    if (values === undefined || values === null || typeof values !== "object") return;

    this._notifications.beginBatch();
    startBatch();
    try {
      const entries = Array.from(this.fields.entries()).sort(([pathA, fieldA], [pathB, fieldB]) => {
        if (fieldA.isArrayField !== fieldB.isArrayField) return fieldA.isArrayField ? -1 : 1;
        return pathA.length - pathB.length;
      });
      for (const [path, field] of entries) {
        if (this._isArrayChildPath(path)) continue;
        const val = getDeepValue(values, path);
        if (val !== undefined) {
          field.setValue(this._formatFieldValue(path, val, "input"));
        }
      }
    } finally {
      endBatch();
      this._notifications.endBatch();
    }
  }

  setInitialValues(values: Record<string, any>): void {
    this._initialValues = { ...values };
  }

  reset(): void {
    this._notifications.beginBatch();
    startBatch();
    try {
      for (const [, field] of this.fields) {
        field.reset();
      }
      // Replay reactions so derived properties (visible/title/dataSource/etc.) re-apply
      // on the freshly restored initial values rather than staying with stale derivations.
      for (const runner of this._reactionRunners) {
        try {
          runner();
        } catch (err) {
          this._emitError({
            scope: "reaction",
            path: "",
            message: "reaction runner failed during reset",
            cause: err,
          });
        }
      }
    } finally {
      endBatch();
      this._notifications.endBatch();
    }
  }

  // ============================================================
  // Validation & submission
  // ============================================================

  async validate(): Promise<boolean> {
    const results = await Promise.all(
      Array.from(this.fields.values())
        .filter((f) => f.visible)
        .map((f) => f.validate()),
    );
    return results.every((errs) => errs.length === 0);
  }

  async submit<T = any>(onSubmit?: (values: Record<string, any>) => T | Promise<T>): Promise<T> {
    this._submitting(true);
    try {
      const isValid = await this.validate();
      if (!isValid) {
        const errors = this.errors;
        const err: any = new Error("Validation failed");
        err.messages = errors.map((e) => e.message);
        throw err;
      }
      if (onSubmit) {
        return await onSubmit(this.values);
      }
      return this.values as T;
    } finally {
      this._submitting(false);
    }
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    for (const dispose of Array.from(this._effectDisposers)) {
      try {
        dispose();
      } catch (err) {
        console.error("[alien-form] destroy disposer threw:", err);
      }
    }

    this._effectDisposers.clear();
    this._disposeReactions();
    this._errorListeners.clear();
  }

  // ============================================================
  // Subscription
  // ============================================================

  subscribe(listener: () => void): () => void {
    const dispose = effect(() => {
      this._version();
      listener();
    });
    return dispose;
  }

  effect(runner: (form: IForm, ctx: EffectContext) => void | (() => void)): () => void;
  effect<T>(
    selector: (form: IForm) => T,
    listener: (value: T, prevValue: T | undefined, ctx: EffectContext) => void,
    options?: EffectOptions<T>,
  ): () => void;
  effect<T>(
    runnerOrSelector:
      | ((form: IForm, ctx: EffectContext) => void | (() => void))
      | ((form: IForm) => T),
    listener?: (value: T, prevValue: T | undefined, ctx: EffectContext) => void,
    options?: EffectOptions<T>,
  ): () => void {
    if (!listener) {
      let stopped = false;
      let effectDispose: (() => void) | null = null;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        if (effectDispose) effectDispose();
        this._effectDisposers.delete(stop);
      };
      const ctx: EffectContext = { form: this, stop };
      effectDispose = effect(() => {
        if (this._destroyed || stopped) return;
        return (runnerOrSelector as (form: IForm, ctx: EffectContext) => void | (() => void))(
          this,
          ctx,
        );
      });
      this._effectDisposers.add(stop);
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
      if (effectDispose) {
        effectDispose();
      }
      this._effectDisposers.delete(stop);
    };

    const ctx: EffectContext = {
      form: this,
      stop,
    };

    effectDispose = effect(() => {
      if (this._destroyed || stopped) return;

      const nextValue = (runnerOrSelector as (form: IForm) => T)(this);

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

    this._effectDisposers.add(stop);
    return stop;
  }

  // ============================================================
  // Schema
  // ============================================================

  setSchema(schema: IFormSchema): void {
    this._notifications.beginBatch();
    startBatch();
    try {
      this._schema = schema;
      this._disposeReactions();
      this._fieldFormats.clear();
      this.fields.clear();
      this._bumpFieldRegistryVersion();
      this._actionCache.clear();

      // Resolve $ref and definitions
      this._definitions = schema.definitions || {};

      if (schema.properties) {
        // Sort by order before creating fields
        const sortedProperties = sortByOrder(schema.properties);
        this._createFieldsFromSchema("", sortedProperties, schema.required);
      }
      // Setup reactions after all fields created
      this._setupReactions(schema);
      this._bumpVersion();
    } finally {
      endBatch();
      this._notifications.endBatch();
    }
  }

  onError(listener: (error: FormError) => void): () => void {
    this._errorListeners.add(listener);
    return () => {
      this._errorListeners.delete(listener);
    };
  }

  private _emitError(error: FormError): void {
    if (this._errorListeners.size === 0) {
      // Fall back to console so silent failures remain debuggable when no
      // listener is attached. Hosts that subscribe take full ownership.
      console.warn(
        `[alien-form] [${error.scope}${error.key ? ":" + error.key : ""}] ${error.path || "<form>"}: ${error.message}`,
        error.cause ?? "",
      );
      return;
    }
    for (const listener of this._errorListeners) {
      try {
        listener(error);
      } catch (err) {
        console.error("[alien-form] onError listener threw:", err);
      }
    }
  }

  _notifyFieldChange(path: string, field: IField): void {
    this._notifications.queueFieldChange(path, field);
    this._notifications.flush();
  }

  _notifyFieldValueChange(path: string, field: IField): void {
    this._notifications.queueReactionTrigger(path);
    this._notifications.queueFieldChange(path, field);
    this._notifications.queueValueChange();
    this._notifications.flush();
  }

  _notifyFieldValidateStart(path: string, field: IField): void {
    void path;
    void field;
  }

  _notifyFieldValidateEnd(path: string, field: IField): void {
    void path;
    void field;
  }

  _notifyFieldValidateFailed(path: string, field: IField): void {
    void path;
    void field;
  }

  _notifyFieldValidateSuccess(path: string, field: IField): void {
    void path;
    void field;
  }

  // ============================================================
  // Internal — Field creation
  // ============================================================

  private _isArrayChildPath(path: string): boolean {
    const parts = path.split(".");
    for (let i = 1; i < parts.length; i++) {
      const parentPath = parts.slice(0, i).join(".");
      const parentField = this.fields.get(parentPath);
      if (parentField && parentField.isArrayField) return true;
    }
    return false;
  }

  private _createFieldsFromSchema(
    prefix: string,
    properties: Record<string, IFieldSchema>,
    parentRequired?: boolean | string[],
    scopeValue?: Record<string, any>,
  ): void {
    // Sort entries by order
    const sortedEntries = Object.entries(properties).sort(([, a], [, b]) => {
      const ai = a.order ?? Infinity;
      const bi = b.order ?? Infinity;
      return ai - bi;
    });

    for (const [key, rawSchema] of sortedEntries) {
      const path = prefix ? `${prefix}.${key}` : key;
      const initialValue =
        scopeValue && typeof scopeValue === "object"
          ? scopeValue[key]
          : getDeepValue(this._initialValues, path);
      this._createFieldTree(path, rawSchema, initialValue, parentRequired);
    }
  }

  _createFieldTree(
    path: string,
    rawSchema: IFieldSchema,
    initialValue?: any,
    parentRequired?: boolean | string[],
  ): void {
    const schema = this._resolveRef(rawSchema);
    const key = path.split(".").pop() || path;
    const isRequired =
      schema.required === true || (Array.isArray(parentRequired) && parentRequired.includes(key));

    if (schema.type === "array" && schema.items) {
      const itemSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
      this.createField(path, { ...schema, required: isRequired }, initialValue);
      if (
        itemSchema &&
        typeof itemSchema === "object" &&
        (itemSchema as IFieldSchema).properties &&
        Array.isArray(initialValue)
      ) {
        const itemProperties = (itemSchema as IFieldSchema).properties!;
        const sortedEntries = Object.entries(itemProperties).sort(([, a], [, b]) => {
          const ai = a.order ?? Infinity;
          const bi = b.order ?? Infinity;
          return ai - bi;
        });
        for (let i = 0; i < initialValue.length; i++) {
          for (const [childKey, childSchema] of sortedEntries) {
            this._createFieldTree(
              `${path}.${i}.${childKey}`,
              childSchema as IFieldSchema,
              initialValue[i]?.[childKey],
              (itemSchema as IFieldSchema).required,
            );
          }
        }
      } else if (itemSchema && typeof itemSchema === "object" && Array.isArray(initialValue)) {
        for (let i = 0; i < initialValue.length; i++) {
          this._createFieldTree(`${path}.${i}`, itemSchema as IFieldSchema, initialValue[i]);
        }
      }
      return;
    }

    if (schema.type === "object" && schema.properties) {
      if (schema.component) {
        this.createField(path, { ...schema, required: isRequired }, initialValue);
      }
      this._createFieldsFromSchema(path, schema.properties, schema.required, initialValue);
      return;
    }

    if (schema.type === "void") {
      if (schema.component) {
        this.createField(path, { ...schema, required: false }, initialValue);
      }
      if (schema.properties) {
        this._createFieldsFromSchema(path, schema.properties, schema.required, initialValue);
      }
      return;
    }

    this.createField(path, { ...schema, required: isRequired }, initialValue);
  }

  // ============================================================
  // $ref and definitions resolution
  // ============================================================

  private _resolveRef(schema: IFieldSchema, seen: Set<string> = new Set()): IFieldSchema {
    if (!schema.$ref) return schema;
    // $ref format: "#/definitions/Name"
    const refPath = schema.$ref.replace(/^#\/definitions\//, "");
    if (seen.has(refPath)) {
      this._emitError({
        scope: "ref-resolve",
        path: "",
        message: `Circular $ref detected: ${schema.$ref} (chain: ${Array.from(seen).join(" -> ")} -> ${refPath})`,
      });
      const { $ref: _ignored, ...localProps } = schema;
      void _ignored;
      return localProps as IFieldSchema;
    }
    const resolved = this._definitions[refPath];
    if (!resolved) {
      this._emitError({
        scope: "ref-resolve",
        path: "",
        message: `Could not resolve $ref: ${schema.$ref}`,
      });
      return schema;
    }
    const nextSeen = new Set(seen);
    nextSeen.add(refPath);
    // Merge: schema props override $ref props (local overrides)
    const localProps = { ...schema };
    delete localProps.$ref;
    return { ...this._resolveRef(resolved, nextSeen), ...localProps };
  }

  // ============================================================
  // X-format system
  // ============================================================

  private _formatInitialValue(path: string, schema: IFieldSchema, value: any): any {
    const format = schema["x-format"];
    if (format) {
      this._fieldFormats.set(path, format);
    }
    if (!format?.input || value === undefined) return value;
    return runXRuleListSync(
      this._ruleRuntime,
      undefined,
      "input",
      format.input,
      buildValueScope(this._ruleRuntime, value),
      "x-format",
      value,
    );
  }

  private _formatFieldValue(path: string, value: any, direction: "input" | "output"): any {
    if (this._formattingValuePaths.has(path)) return value;
    const format = this._fieldFormats.get(path);
    const rules = format?.[direction];
    if (!rules || value === undefined) return value;
    const field = this.fields.get(path);
    this._formattingValuePaths.add(path);
    try {
      return runXRuleListSync(
        this._ruleRuntime,
        field,
        direction,
        rules,
        buildValueScope(this._ruleRuntime, value, field),
        "x-format",
        value,
      );
    } finally {
      this._formattingValuePaths.delete(path);
    }
  }

  // ============================================================
  // X-validate system
  // ============================================================

  async _runXValidate(field: IField, rules: SchemaXValidate, value: any): Promise<FieldError[]> {
    const ruleList = Array.isArray(rules) ? rules : [rules];
    const errors: FieldError[] = [];
    for (const rule of ruleList) {
      const { deps, depsArray } = resolveDependencies(
        this._ruleRuntime,
        rule.dependencies,
        field.path,
      );
      const resolved = await resolveXRuleValue(
        this._ruleRuntime,
        field,
        "validate",
        rule,
        {
          ...buildValueScope(this._ruleRuntime, value, field),
          $deps: depsArray.length > 0 ? depsArray : deps,
          $dependencies: deps,
        },
        "x-validate",
      );
      errors.push(...normalizeValidationErrors(resolved));
    }
    return errors;
  }

  // ============================================================
  // X-rule system
  // ============================================================

  private _setupReactions(schema: IFormSchema): void {
    if (!schema.properties) return;
    this._setupFieldReactions("", schema.properties);
  }

  _rebuildReactions(): void {
    if (!this._schema) return;
    this._disposeReactions();
    this._setupReactions(this._schema);
  }

  private _setupFieldReactions(prefix: string, properties: Record<string, IFieldSchema>): void {
    for (const [key, schema] of Object.entries(properties)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const reactions = schema["x-reaction"];

      if (reactions) {
        for (const [reactionKey, ruleOrRules] of Object.entries(reactions)) {
          if (!ruleOrRules) continue;
          const rules = Array.isArray(ruleOrRules) ? ruleOrRules : [ruleOrRules];
          for (const rule of rules) {
            if (!rule) continue;
            this._setupPropertyReaction(path, reactionKey, rule);
          }
        }
      }

      // Recurse
      if (schema.properties) {
        this._setupFieldReactions(path, schema.properties);
      }
      if (schema.items) {
        const itemSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
        if (
          itemSchema &&
          typeof itemSchema === "object" &&
          (itemSchema as IFieldSchema).properties
        ) {
          const arrayField = this.fields.get(path);
          const rowCount =
            arrayField?.isArrayField && Array.isArray(arrayField.value)
              ? arrayField.value.length
              : 0;
          for (let index = 0; index < rowCount; index++) {
            this._setupFieldReactions(`${path}.${index}`, (itemSchema as IFieldSchema).properties!);
          }
        }
      }
    }
  }

  private _setupPropertyReaction(selfPath: string, reactionKey: string, rule: SchemaXRule): void {
    const runnerId = `${selfPath}:${reactionKey}:${this._reactionRunnerSeq++}`;
    const runner = () => {
      this._runReactionRunner(runnerId, selfPath, reactionKey, () => {
        const field = this.fields.get(selfPath);
        if (!field) return;

        const { deps, depsArray } = resolveDependencies(
          this._ruleRuntime,
          rule.dependencies,
          selfPath,
        );
        const scope = buildReactionScope(this._ruleRuntime, field, deps, depsArray);
        void this._runPropertyReaction(field, reactionKey, rule, scope);
      });
    };

    this._reactionRunners.push(runner);

    const depPaths = this._getReactionDependencyPaths(rule, selfPath);
    if (depPaths.length === 0) {
      runner();
      return;
    }

    runner();
    for (const depPath of depPaths) {
      this._registerReactionValueTrigger(depPath, runner);
    }
  }

  private _getReactionDependencyPaths(rule: SchemaXRule, selfPath: string): string[] {
    const dependencies = rule.dependencies;
    if (!dependencies) return [selfPath];

    const rawPaths = Array.isArray(dependencies) ? dependencies : Object.values(dependencies);
    return Array.from(new Set(rawPaths.map((path) => resolveFieldPath(path, selfPath))));
  }

  private _registerReactionValueTrigger(path: string, runner: () => void): void {
    if (!this._reactionValueTriggers.has(path)) {
      this._reactionValueTriggers.set(path, new Set());
    }
    const runners = this._reactionValueTriggers.get(path)!;
    runners.add(runner);
    this._reactionDisposers.push(() => {
      runners.delete(runner);
    });
  }

  private _runReactionValueTriggers(path: string): void {
    const runners = this._reactionValueTriggers.get(path);
    if (!runners || runners.size === 0) return;
    for (const runner of Array.from(runners)) {
      runner();
    }
  }

  private _runReactionRunner(id: string, path: string, key: string, runner: () => void): void {
    const nextCount = (this._reactionRunCounts.get(id) || 0) + 1;
    if (nextCount > MAX_REACTION_RUNS_PER_FLUSH) {
      this._emitError({
        scope: "reaction",
        path,
        key,
        message: `reaction cycle detected: "${path}.${key}" ran more than ${MAX_REACTION_RUNS_PER_FLUSH} times in one flush`,
      });
      return;
    }

    this._reactionRunCounts.set(id, nextCount);
    this._reactionRunDepth += 1;
    try {
      runner();
    } finally {
      this._reactionRunDepth -= 1;
      if (this._reactionRunDepth === 0 && !this._notifications.isFlushing) {
        this._reactionRunCounts.clear();
      }
    }
  }

  private _runPropertyReaction(
    field: IField,
    reactionKey: string,
    rule: SchemaXRule,
    scope: Record<string, any>,
  ): void {
    try {
      const value = resolveXRuleValue(
        this._ruleRuntime,
        field,
        reactionKey,
        rule,
        scope,
        "x-reaction",
      );
      if (isPromiseLike(value)) {
        const versionKey = this._getAsyncReactionVersionKey(field.path, reactionKey);
        const currentVersion = (this._asyncReactionVersions.get(versionKey) || 0) + 1;
        this._asyncReactionVersions.set(versionKey, currentVersion);
        void value
          .then((resolved) => {
            if (this._asyncReactionVersions.get(versionKey) !== currentVersion) return;
            applyReactionValue(this._ruleRuntime, field, reactionKey, resolved);
          })
          .catch((err) => {
            if (this._asyncReactionVersions.get(versionKey) !== currentVersion) return;
            this._emitError({
              scope: "reaction",
              path: field.path,
              key: reactionKey,
              message: err instanceof Error ? err.message : String(err),
              cause: err,
            });
          });
        return;
      }
      applyReactionValue(this._ruleRuntime, field, reactionKey, value);
    } catch (err) {
      this._emitError({
        scope: "reaction",
        path: field.path,
        key: reactionKey,
        message: err instanceof Error ? err.message : String(err),
        cause: err,
      });
    }
  }

  // ============================================================
  // Internal helpers
  // ============================================================

  private _bumpVersion(): void {
    this._valuesCache = null;
    this._rawValuesCache = null;
    if (this._notifications.isBatching || this._notifications.isFlushing) {
      this._notifications.queueVersionChange();
      return;
    }
    this._commitVersionChange();
  }

  private _commitVersionChange(): void {
    this._valuesCache = null;
    this._rawValuesCache = null;
    this._version(this._version() + 1);
  }

  private _bumpFieldRegistryVersion(): void {
    this._valuesCache = null;
    this._rawValuesCache = null;
    this._fieldRegistryVersion(this._fieldRegistryVersion() + 1);
  }

  private _disposeReactions(): void {
    for (const dispose of this._reactionDisposers) dispose();
    this._reactionDisposers = [];
    this._reactionValueTriggers.clear();
    this._reactionRunners = [];
    this._asyncReactionVersions.clear();
    this._fieldLoadingCounts.clear();
  }

  private _trackDispose(dispose: () => void): () => void {
    let disposed = false;

    const trackedDispose = () => {
      if (disposed) return;
      disposed = true;
      this._effectDisposers.delete(trackedDispose);
      dispose();
    };

    this._effectDisposers.add(trackedDispose);
    return trackedDispose;
  }

  private _getAsyncReactionVersionKey(path: string, reactionKey: string): string {
    return `${path}:${reactionKey}`;
  }

  private _beginFieldLoading(field: IField): void {
    const nextCount = (this._fieldLoadingCounts.get(field.path) || 0) + 1;
    this._fieldLoadingCounts.set(field.path, nextCount);
    if (nextCount === 1) {
      field.setLoading(true);
    }
  }

  private _endFieldLoading(field: IField): void {
    const currentCount = this._fieldLoadingCounts.get(field.path) || 0;
    if (currentCount <= 1) {
      this._fieldLoadingCounts.delete(field.path);
      field.setLoading(false);
      return;
    }
    this._fieldLoadingCounts.set(field.path, currentCount - 1);
  }

  private _rawValues(): Record<string, any> {
    if (this._rawValuesCache !== null) return this._rawValuesCache;
    const result: Record<string, any> = {};
    for (const [path, field] of this.fields) {
      if (!field.visible) continue;
      if (this._isArrayChildPath(path)) continue;
      if (field.component && isVoidField(path, this._schema)) continue;
      setDeepValue(result, path, field.value);
    }
    this._rawValuesCache = result;
    return result;
  }
}

// ============================================================
// Factory
// ============================================================

export function createForm(config?: FormConfig): IForm {
  return new Form(config);
}
