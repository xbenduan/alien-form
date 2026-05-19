/**
 * @alien-form/core — Form model implementation
 * Enterprise schema protocol inspired by Formily
 */

import { signal, effect, startBatch, endBatch } from 'alien-signals'
import { Field } from './field'
import type {
  IForm,
  IField,
  FieldError,
  IFormSchema,
  IFieldSchema,
  FormConfig,
  SchemaXRule,
  SchemaReactionKey,
  SchemaFormat,
  SchemaXValidate,
  Validator,
  ValidatorRule,
  FieldMutableState,
  FormError,
} from './types'

import { assertSafeExpression } from './expression-safety'
import {
  getDeepValue,
  setDeepValue,
  isPromiseLike,
  sortByOrder,
  isVoidField,
} from './path-utils'
import {
  normalizeDataSource,
  normalizeValidationErrors,
} from './validator-runner'


// ============================================================
// Lifecycle event types
// ============================================================

type LifecycleHandler = (field: IField, form: IForm) => void

type SchemaReactionEffect =
  | 'onFieldInit'
  | 'onFieldMount'
  | 'onFieldUnmount'
  | 'onFieldValueChange'
  | 'onFieldInputValueChange'
  | 'onFieldInitialValueChange'
  | 'onFieldValidateStart'
  | 'onFieldValidateEnd'
  | 'onFieldValidateFailed'
  | 'onFieldValidateSuccess'

interface LifecycleRegistry {
  onFieldInit: Map<string, Set<LifecycleHandler>>
  onFieldMount: Map<string, Set<LifecycleHandler>>
  onFieldUnmount: Map<string, Set<LifecycleHandler>>
  onFieldValueChange: Map<string, Set<LifecycleHandler>>
  onFieldInputValueChange: Map<string, Set<LifecycleHandler>>
  onFieldInitialValueChange: Map<string, Set<LifecycleHandler>>
  onFieldValidateStart: Map<string, Set<LifecycleHandler>>
  onFieldValidateEnd: Map<string, Set<LifecycleHandler>>
  onFieldValidateFailed: Map<string, Set<LifecycleHandler>>
  onFieldValidateSuccess: Map<string, Set<LifecycleHandler>>
}

function createLifecycleRegistry(): LifecycleRegistry {
  return {
    onFieldInit: new Map(),
    onFieldMount: new Map(),
    onFieldUnmount: new Map(),
    onFieldValueChange: new Map(),
    onFieldInputValueChange: new Map(),
    onFieldInitialValueChange: new Map(),
    onFieldValidateStart: new Map(),
    onFieldValidateEnd: new Map(),
    onFieldValidateFailed: new Map(),
    onFieldValidateSuccess: new Map(),
  }
}

// ============================================================
// Form class
// ============================================================

export class Form implements IForm {
  fields: Map<string, IField> = new Map()
  private _initialValues: Record<string, any>
  private _submitting: ReturnType<typeof signal<boolean>>
  private _version: ReturnType<typeof signal<number>>
  private _fieldChangeListeners: Map<string, Set<(field: IField) => void>> = new Map()
  private _valuesChangeListeners: Set<(values: Record<string, any>) => void> = new Set()
  private _errorListeners: Set<(error: FormError) => void> = new Set()
  private _schema: IFormSchema | null = null
  private _reactionDisposers: Array<() => void> = []
  private _reactionValueTriggers: Map<string, Set<() => void>> = new Map()
  private _reactionRunners: Array<() => void> = []
  private _actionCache: Map<string, string> = new Map()
  private _fieldFormats: Map<string, SchemaFormat> = new Map()
  private _formattingValuePaths: Set<string> = new Set()
  private _config: FormConfig
  private _scope: Record<string, any>
  private _lifecycle: LifecycleRegistry
  private _definitions: Record<string, IFieldSchema> = {}
  private _valuesCache: Record<string, any> | null = null
  private _rawValuesCache: Record<string, any> | null = null
  private _asyncReactionVersions: Map<string, number> = new Map()
  private _fieldLoadingCounts: Map<string, number> = new Map()

  constructor(config: FormConfig = {}) {
    this._config = config
    this._initialValues = config.initialValues ? { ...config.initialValues } : {}
    this._submitting = signal(false)
    this._version = signal(0)
    this._scope = config.scope || {}
    this._lifecycle = createLifecycleRegistry()

    if (config.onError) {
      this._errorListeners.add(config.onError)
    }

    if (config.effects) {
      config.effects(this)
    }
  }

  // ============================================================
  // Computed properties
  // ============================================================

  get values(): Record<string, any> {
    if (this._valuesCache !== null) return this._valuesCache
    const result: Record<string, any> = {}
    for (const [path, field] of this.fields) {
      if (!field.visible) continue
      // Skip array child fields — they are part of the array field's value
      if (this._isArrayChildPath(path)) continue
      // Skip void fields — they are layout containers
      if (field.component && isVoidField(path, this._schema)) continue
      setDeepValue(result, path, this._formatFieldValue(path, field.value, 'output'))
    }
    this._valuesCache = result
    return result
  }

  get initialValues(): Record<string, any> {
    return this._initialValues
  }

  get valid(): boolean {
    for (const [, field] of this.fields) {
      if (field.visible && field.errors.length > 0) return false
    }
    return true
  }

  get invalid(): boolean {
    return !this.valid
  }

  get submitting(): boolean {
    return this._submitting()
  }

  get errors(): FieldError[] {
    const allErrors: FieldError[] = []
    for (const [, field] of this.fields) {
      if (field.visible) allErrors.push(...field.errors)
    }
    return allErrors
  }

  // ============================================================
  // Field creation & access
  // ============================================================

  createField(path: string, schema: IFieldSchema, initialValue?: any): IField {
    const rawInitVal = initialValue !== undefined ? initialValue : getDeepValue(this._initialValues, path)
    const sourceInitVal = rawInitVal !== undefined ? rawInitVal : schema.default
    const initVal = this._formatInitialValue(path, schema, sourceInitVal)
    const fieldSchema = rawInitVal === undefined && schema.default !== undefined ? { ...schema, default: undefined } : schema
    const field = new Field(path, fieldSchema, initVal)
    ;(field as Field)._setForm(this)
    this.fields.set(path, field)
    this._bumpVersion()

    // Emit onFieldInit lifecycle
    this._emitLifecycle('onFieldInit', path, field)

    return field
  }

  getField(path: string): IField | undefined {
    return this.fields.get(path)
  }

  setFieldState(path: string, setter: (state: Partial<FieldMutableState>) => void): void {
    const field = this.fields.get(path)
    if (!field) return
    const state: Partial<FieldMutableState> = {}
    setter(state)
    field.setState(state)
    this._bumpVersion()
  }

  getArrayField(path: string): IField | undefined {
    const field = this.fields.get(path)
    if (field && field.isArrayField) return field
    return undefined
  }

  removeArrayItem(arrayPath: string, index: number): void {
    const field = this.getArrayField(arrayPath)
    if (field) {
      field.remove(index)
      this._bumpVersion()
    }
  }

  // ============================================================
  // Value operations
  // ============================================================

  setValues(values: Record<string, any>): void {
    startBatch()
    for (const [path, field] of this.fields) {
      const val = getDeepValue(values, path)
      if (val !== undefined) {
        field.setValue(this._formatFieldValue(path, val, 'input'))
      }
    }
    this._bumpVersion()
    endBatch()
    this._notifyValuesChange()
  }

  setInitialValues(values: Record<string, any>): void {
    this._initialValues = { ...values }
  }

  reset(): void {
    startBatch()
    for (const [, field] of this.fields) {
      field.reset()
    }
    // Replay reactions so derived properties (visible/title/dataSource/etc.) re-apply
    // on the freshly restored initial values rather than staying with stale derivations.
    for (const runner of this._reactionRunners) {
      try {
        runner()
      } catch (err) {
        this._emitError({ scope: 'reaction', path: '', message: 'reaction runner failed during reset', cause: err })
      }
    }
    this._bumpVersion()
    endBatch()
    this._notifyValuesChange()
  }

  // ============================================================
  // Validation & submission
  // ============================================================

  async validate(): Promise<boolean> {
    const results = await Promise.all(
      Array.from(this.fields.values())
        .filter((f) => f.visible)
        .map((f) => f.validate())
    )
    return results.every((errs) => errs.length === 0)
  }

  async submit<T = any>(onSubmit?: (values: Record<string, any>) => T | Promise<T>): Promise<T> {
    this._submitting(true)
    try {
      const isValid = await this.validate()
      if (!isValid) {
        const errors = this.errors
        const err: any = new Error('Validation failed')
        err.messages = errors.map((e) => e.message)
        throw err
      }
      if (onSubmit) {
        return await onSubmit(this.values)
      }
      return this.values as T
    } finally {
      this._submitting(false)
    }
  }

  // ============================================================
  // Subscription
  // ============================================================

  subscribe(listener: () => void): () => void {
    const dispose = effect(() => {
      this._version()
      listener()
    })
    return dispose
  }

  // ============================================================
  // Schema
  // ============================================================

  setSchema(schema: IFormSchema): void {
    this._schema = schema
    this._disposeReactions()
    this._fieldFormats.clear()
    this.fields.clear()
    this._actionCache.clear()

    // Resolve $ref and definitions
    this._definitions = schema.definitions || {}

    if (schema.properties) {
      // Sort by order before creating fields
      const sortedProperties = sortByOrder(schema.properties)
      this._createFieldsFromSchema('', sortedProperties, schema.required)
    }
    // Setup reactions after all fields created
    this._setupReactions(schema)
    this._bumpVersion()
  }

  // ============================================================
  // Lifecycle hooks — used by FormConfig.effects
  // ============================================================

  onFieldChange(path: string, listener: (field: IField) => void): () => void {
    if (!this._fieldChangeListeners.has(path)) {
      this._fieldChangeListeners.set(path, new Set())
    }
    this._fieldChangeListeners.get(path)!.add(listener)
    return () => {
      this._fieldChangeListeners.get(path)?.delete(listener)
    }
  }

  onValuesChange(listener: (values: Record<string, any>) => void): () => void {
    this._valuesChangeListeners.add(listener)
    return () => {
      this._valuesChangeListeners.delete(listener)
    }
  }

  onError(listener: (error: FormError) => void): () => void {
    this._errorListeners.add(listener)
    return () => {
      this._errorListeners.delete(listener)
    }
  }

  private _emitError(error: FormError): void {
    if (this._errorListeners.size === 0) {
      // Fall back to console so silent failures remain debuggable when no
      // listener is attached. Hosts that subscribe take full ownership.
      console.warn(`[alien-form] [${error.scope}${error.key ? ":" + error.key : ""}] ${error.path || "<form>"}: ${error.message}`, error.cause ?? "")
      return
    }
    for (const listener of this._errorListeners) {
      try {
        listener(error)
      } catch (err) {
        console.error("[alien-form] onError listener threw:", err)
      }
    }
  }

  // Lifecycle registration (used in effects)
  registerLifecycle(event: SchemaReactionEffect, path: string, handler: LifecycleHandler): () => void {
    const map = this._lifecycle[event]
    if (!map) return () => {}
    if (!map.has(path)) {
      map.set(path, new Set())
    }
    map.get(path)!.add(handler)
    return () => {
      map.get(path)?.delete(handler)
    }
  }

  // Emit a lifecycle event for a field
  _emitLifecycle(event: SchemaReactionEffect, path: string, field: IField): void {
    const map = this._lifecycle[event]
    if (!map) return
    // Exact match
    const handlers = map.get(path)
    if (handlers) {
      for (const handler of handlers) {
        handler(field, this)
      }
    }
    // Wildcard match
    const wildcardHandlers = map.get('*')
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        handler(field, this)
      }
    }
  }


  _notifyFieldChange(path: string, field: IField): void {
    const handlers = this._fieldChangeListeners.get(path)
    if (handlers) {
      for (const handler of handlers) handler(field)
    }
    const wildcardHandlers = this._fieldChangeListeners.get('*')
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) handler(field)
    }
    this._bumpVersion()
  }

  _notifyFieldValueChange(path: string, field: IField): void {
    this._emitLifecycle('onFieldValueChange', path, field)
    this._emitLifecycle('onFieldInputValueChange', path, field)
    this._runReactionValueTriggers(path)
    this._notifyFieldChange(path, field)
    this._notifyValuesChange()
  }

  _notifyFieldValidateStart(path: string, field: IField): void {
    this._emitLifecycle('onFieldValidateStart', path, field)
  }

  _notifyFieldValidateEnd(path: string, field: IField): void {
    this._emitLifecycle('onFieldValidateEnd', path, field)
  }

  _notifyFieldValidateFailed(path: string, field: IField): void {
    this._emitLifecycle('onFieldValidateFailed', path, field)
  }

  _notifyFieldValidateSuccess(path: string, field: IField): void {
    this._emitLifecycle('onFieldValidateSuccess', path, field)
  }

  // ============================================================
  // Internal — Field creation
  // ============================================================

  private _isArrayChildPath(path: string): boolean {
    const parts = path.split('.')
    for (let i = 1; i < parts.length; i++) {
      const parentPath = parts.slice(0, i).join('.')
      const parentField = this.fields.get(parentPath)
      if (parentField && parentField.isArrayField) return true
    }
    return false
  }

  private _createFieldsFromSchema(
    prefix: string,
    properties: Record<string, IFieldSchema>,
    parentRequired?: boolean | string[],
    scopeValue?: Record<string, any>
  ): void {
    // Sort entries by order
    const sortedEntries = Object.entries(properties).sort(([, a], [, b]) => {
      const ai = a.order ?? Infinity
      const bi = b.order ?? Infinity
      return ai - bi
    })

    for (const [key, rawSchema] of sortedEntries) {
      const path = prefix ? `${prefix}.${key}` : key
      const initialValue =
        scopeValue && typeof scopeValue === 'object' ? scopeValue[key] : getDeepValue(this._initialValues, path)
      this._createFieldTree(path, rawSchema, initialValue, parentRequired)
    }
  }

  _createFieldTree(
    path: string,
    rawSchema: IFieldSchema,
    initialValue?: any,
    parentRequired?: boolean | string[]
  ): void {
    const schema = this._resolveRef(rawSchema)
    const key = path.split('.').pop() || path
    const isRequired = schema.required === true ||
      (Array.isArray(parentRequired) && parentRequired.includes(key))

    if (schema.type === 'array' && schema.items) {
      const itemSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items
      this.createField(path, { ...schema, required: isRequired }, initialValue)
      if (itemSchema && typeof itemSchema === 'object' && (itemSchema as IFieldSchema).properties && Array.isArray(initialValue)) {
        const itemProperties = (itemSchema as IFieldSchema).properties!
        const sortedEntries = Object.entries(itemProperties).sort(([, a], [, b]) => {
          const ai = a.order ?? Infinity
          const bi = b.order ?? Infinity
          return ai - bi
        })
        for (let i = 0; i < initialValue.length; i++) {
          for (const [childKey, childSchema] of sortedEntries) {
            this._createFieldTree(
              `${path}.${i}.${childKey}`,
              childSchema as IFieldSchema,
              initialValue[i]?.[childKey],
              (itemSchema as IFieldSchema).required
            )
          }
        }
      }
      return
    }

    if (schema.type === 'object' && schema.properties) {
      if (schema.component) {
        this.createField(path, { ...schema, required: isRequired }, initialValue)
      }
      this._createFieldsFromSchema(path, schema.properties, schema.required, initialValue)
      return
    }

    if (schema.type === 'void') {
      if (schema.component) {
        this.createField(path, { ...schema, required: false }, initialValue)
      }
      if (schema.properties) {
        this._createFieldsFromSchema(path, schema.properties, schema.required, initialValue)
      }
      return
    }

    this.createField(path, { ...schema, required: isRequired }, initialValue)
  }

  // ============================================================
  // $ref and definitions resolution
  // ============================================================

  private _resolveRef(schema: IFieldSchema, seen: Set<string> = new Set()): IFieldSchema {
    if (!schema.$ref) return schema
    // $ref format: "#/definitions/Name"
    const refPath = schema.$ref.replace(/^#\/definitions\//, '')
    if (seen.has(refPath)) {
      this._emitError({ scope: 'ref-resolve', path: '', message: `Circular $ref detected: ${schema.$ref} (chain: ${Array.from(seen).join(' -> ')} -> ${refPath})` })
      const { $ref: _ignored, ...localProps } = schema
      void _ignored
      return localProps as IFieldSchema
    }
    const resolved = this._definitions[refPath]
    if (!resolved) {
      this._emitError({ scope: 'ref-resolve', path: '', message: `Could not resolve $ref: ${schema.$ref}` })
      return schema
    }
    const nextSeen = new Set(seen)
    nextSeen.add(refPath)
    // Merge: schema props override $ref props (local overrides)
    const { $ref, ...localProps } = schema
    return { ...this._resolveRef(resolved, nextSeen), ...localProps }
  }

  // ============================================================
  // X-format system
  // ============================================================

  private _formatInitialValue(path: string, schema: IFieldSchema, value: any): any {
    const format = schema['x-format']
    if (format) {
      this._fieldFormats.set(path, format)
    }
    if (!format?.input || value === undefined) return value
    return this._runXRuleListSync(undefined, 'input', format.input, this._buildValueScope(value), 'x-format', value)
  }

  private _formatFieldValue(path: string, value: any, direction: 'input' | 'output'): any {
    if (this._formattingValuePaths.has(path)) return value
    const format = this._fieldFormats.get(path)
    const rules = format?.[direction]
    if (!rules || value === undefined) return value
    const field = this.fields.get(path)
    this._formattingValuePaths.add(path)
    try {
      return this._runXRuleListSync(field, direction, rules, this._buildValueScope(value, field), 'x-format', value)
    } finally {
      this._formattingValuePaths.delete(path)
    }
  }

  // ============================================================
  // X-validate system
  // ============================================================

  async _runXValidate(field: IField, rules: SchemaXValidate, value: any): Promise<FieldError[]> {
    const ruleList = Array.isArray(rules) ? rules : [rules]
    const errors: FieldError[] = []
    for (const rule of ruleList) {
      const { deps, depsArray } = this._resolveDependencies(rule.dependencies, field.path)
      const resolved = await this._resolveXRuleValue(
        field,
        'validate',
        rule,
        {
          ...this._buildValueScope(value, field),
          $deps: depsArray.length > 0 ? depsArray : deps,
          $dependencies: deps,
        },
        'x-validate'
      )
      errors.push(...normalizeValidationErrors(resolved))
    }
    return errors
  }

  // ============================================================
  // X-rule system
  // ============================================================

  private _setupReactions(schema: IFormSchema): void {
    if (!schema.properties) return
    this._setupFieldReactions('', schema.properties)
  }

  _rebuildReactions(): void {
    if (!this._schema) return
    this._disposeReactions()
    this._setupReactions(this._schema)
  }

  private _setupFieldReactions(prefix: string, properties: Record<string, IFieldSchema>): void {
    for (const [key, schema] of Object.entries(properties)) {
      const path = prefix ? `${prefix}.${key}` : key
      const reactions = schema['x-reaction']

      if (reactions) {
        for (const [reactionKey, ruleOrRules] of Object.entries(reactions)) {
          if (!ruleOrRules) continue
          const rules = Array.isArray(ruleOrRules) ? ruleOrRules : [ruleOrRules]
          for (const rule of rules) {
            if (!rule) continue
            this._setupPropertyReaction(path, reactionKey, rule)
          }
        }
      }

      // Recurse
      if (schema.properties) {
        this._setupFieldReactions(path, schema.properties)
      }
      if (schema.items) {
        const itemSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items
        if (itemSchema && typeof itemSchema === 'object' && (itemSchema as IFieldSchema).properties) {
          const arrayField = this.fields.get(path)
          const rowCount = arrayField?.isArrayField && Array.isArray(arrayField.value)
            ? arrayField.value.length
            : 0
          for (let index = 0; index < rowCount; index++) {
            this._setupFieldReactions(`${path}.${index}`, (itemSchema as IFieldSchema).properties!)
          }
        }
      }
    }
  }

  private _setupPropertyReaction(selfPath: string, reactionKey: string, rule: SchemaXRule): void {
    const runner = () => {
      const field = this.fields.get(selfPath)
      if (!field) return

      const { deps, depsArray } = this._resolveDependencies(rule.dependencies, selfPath)
      const scope = this._buildScope(field, deps, depsArray)
      void this._runPropertyReaction(field, reactionKey, rule, scope)
    }

    this._reactionRunners.push(runner)

    const depPaths = this._getReactionDependencyPaths(rule, selfPath)
    if (depPaths.length === 0) {
      runner()
      return
    }

    runner()
    for (const depPath of depPaths) {
      this._registerReactionValueTrigger(depPath, runner)
    }
  }

  private _getReactionDependencyPaths(rule: SchemaXRule, selfPath: string): string[] {
    const dependencies = rule.dependencies
    if (!dependencies) return [selfPath]

    const rawPaths = Array.isArray(dependencies) ? dependencies : Object.values(dependencies)
    return Array.from(new Set(rawPaths.map((path) => this._resolveFieldPath(path, selfPath))))
  }

  private _registerReactionValueTrigger(path: string, runner: () => void): void {
    if (!this._reactionValueTriggers.has(path)) {
      this._reactionValueTriggers.set(path, new Set())
    }
    const runners = this._reactionValueTriggers.get(path)!
    runners.add(runner)
    this._reactionDisposers.push(() => {
      runners.delete(runner)
    })
  }

  private _runReactionValueTriggers(path: string): void {
    const runners = this._reactionValueTriggers.get(path)
    if (!runners || runners.size === 0) return
    for (const runner of Array.from(runners)) {
      runner()
    }
  }

  private _runPropertyReaction(
    field: IField,
    reactionKey: string,
    rule: SchemaXRule,
    scope: Record<string, any>
  ): void {
    try {
      const value = this._resolveXRuleValue(field, reactionKey, rule, scope, 'x-reaction')
      if (isPromiseLike(value)) {
        const versionKey = this._getAsyncReactionVersionKey(field.path, reactionKey)
        const currentVersion = (this._asyncReactionVersions.get(versionKey) || 0) + 1
        this._asyncReactionVersions.set(versionKey, currentVersion)
        void value
          .then((resolved) => {
            if (this._asyncReactionVersions.get(versionKey) !== currentVersion) return
            this._applyReactionValue(field, reactionKey, resolved)
          })
          .catch((err) => {
            if (this._asyncReactionVersions.get(versionKey) !== currentVersion) return
            this._emitError({ scope: 'reaction', path: field.path, key: reactionKey, message: err instanceof Error ? err.message : String(err), cause: err })
          })
        return
      }
      this._applyReactionValue(field, reactionKey, value)
    } catch (err) {
      this._emitError({ scope: 'reaction', path: field.path, key: reactionKey, message: err instanceof Error ? err.message : String(err), cause: err })
    }
  }

  private _resolveXRuleValue(
    field: IField | undefined,
    key: string,
    rule: SchemaXRule,
    scope: Record<string, any>,
    kind: 'x-reaction' | 'x-format' | 'x-validate'
  ): any {
    switch (rule.type) {
      case 'static':
        return rule.value
      case 'expression':
        return this._evalExpressionInScope(rule.expression, scope)
      case 'match': {
        const source = rule.source
          ? this._evalExpressionInScope(rule.source, scope)
          : kind === 'x-format' || kind === 'x-validate'
            ? scope.$value
            : this._defaultMatchSource(scope)
        const matchKey = source === undefined || source === null ? 'default' : String(source)
        return Object.prototype.hasOwnProperty.call(rule.match, matchKey)
          ? rule.match[matchKey]
          : rule.match.default
      }
      case 'computed': {
        const handler = this._config.handlers?.[rule.handler]
        if (!handler) return undefined
        const shouldSetLoading = kind === 'x-reaction' && !!field
        if (shouldSetLoading) this._beginFieldLoading(field as IField)
        const result = handler({
          field: field as IField,
          form: this,
          values: this._rawValues(),
          deps: scope.$dependencies,
          dependencies: scope.$dependencies,
          scope,
          key,
          rule,
          value: scope.$value,
          kind,
        })
        if (isPromiseLike(result)) {
          return result.finally(() => {
            if (shouldSetLoading) this._endFieldLoading(field as IField)
          })
        }
        if (shouldSetLoading) this._endFieldLoading(field as IField)
        return result
      }
    }
  }

  private _runXRuleListSync(
    field: IField | undefined,
    key: string,
    ruleOrRules: SchemaXRule | SchemaXRule[],
    scope: Record<string, any>,
    kind: 'x-reaction' | 'x-format' | 'x-validate',
    fallback: any
  ): any {
    const rules = Array.isArray(ruleOrRules) ? ruleOrRules : [ruleOrRules]
    let current = fallback
    for (const rule of rules) {
      const valueScope = { ...scope, $value: current }
      const value = this._resolveXRuleValue(field, key, rule, valueScope, kind)
      if (isPromiseLike(value)) {
        // x-format runs on the synchronous value-update path (form.values is a
        // sync getter, setValue is sync). Async computed handlers there would
        // silently return Promise objects as the formatted value, producing
        // values like "[object Promise]". Make this a hard, attributable error.
        const path = field?.path || '<root>'
        const msg = `[alien-form] ${kind} "${key}" for "${path}" returned a Promise in a synchronous phase. ` +
          (kind === 'x-format'
            ? 'x-format handlers must be synchronous — move async work to x-reaction (computed) where Promises are awaited.'
            : 'This phase does not await Promises; the rule was skipped.')
        if (kind === 'x-format') {
          throw new Error(msg)
        }
        this._emitError({ scope: kind, path: field?.path || '', key, message: msg })
        continue
      }
      if (value !== undefined) current = value
    }
    return current
  }

  private async _runXRuleListAsync(
    field: IField | undefined,
    key: string,
    ruleOrRules: SchemaXRule | SchemaXRule[],
    scope: Record<string, any>,
    kind: 'x-reaction' | 'x-format' | 'x-validate',
    fallback: any
  ): Promise<any> {
    const rules = Array.isArray(ruleOrRules) ? ruleOrRules : [ruleOrRules]
    let current = fallback
    for (const rule of rules) {
      const valueScope = { ...scope, $value: current }
      const value = await this._resolveXRuleValue(field, key, rule, valueScope, kind)
      if (value !== undefined) current = value
    }
    return current
  }

  private _defaultMatchSource(scope: Record<string, any>): any {
    const deps = scope.$dependencies || {}
    const values = Object.values(deps)
    return values.length === 1 ? values[0] : undefined
  }

  private _applyReactionValue(field: IField, reactionKey: string, value: any): void {
    if (value === undefined) return

    switch (reactionKey as SchemaReactionKey | string) {
      case 'value':
        field.setValue(value)
        break
      case 'display':
        field.setDisplay(value)
        break
      case 'visible':
        field.setState({ visible: value })
        break
      case 'hidden':
        field.setState({ hidden: value })
        break
      case 'pattern':
        field.setPattern(value)
        break
      case 'disabled':
        field.setState({ disabled: value })
        break
      case 'readOnly':
        field.setState({ readOnly: value })
        break
      case 'readPretty':
        field.setState({ readPretty: value })
        break
      case 'editable':
        field.setState({ editable: value })
        break
      case 'required':
        field.setState({ required: value })
        break
      case 'title':
        field.setState({ title: value })
        break
      case 'description':
        field.setState({ description: value })
        break
      case 'props':
        field.setState({ componentProps: { ...field.componentProps, ...value } })
        break
      case 'decoratorProps':
        field.setState({ decoratorProps: { ...field.decoratorProps, ...value } })
        break
      case 'component':
        if (Array.isArray(value)) field.setComponent(value[0], value[1])
        else field.setComponent(value)
        break
      case 'decorator':
        if (Array.isArray(value)) field.setDecorator(value[0], value[1])
        else field.setDecorator(value)
        break
      case 'dataSource':
        field.setDataSource(normalizeDataSource(value))
        break
      default:
        this._emitError({ scope: 'reaction', path: field.path, key: reactionKey, message: `unsupported reaction key "${reactionKey}"` })
    }
  }

  // ============================================================
  // Scope building — $self, $values, $form, $deps, $dependencies
  // ============================================================

  private _buildScope(
    selfField: IField,
    deps: Record<string, any>,
    depsArray: any[]
  ): Record<string, any> {
    return {
      // Built-in scope variables
      $self: selfField,
      $form: this,
      $values: this.values,
      $deps: depsArray.length > 0 ? depsArray : deps,
      $dependencies: deps,
      $value: selfField.value,
      // User custom scope
      ...this._scope,
    }
  }

  private _buildValueScope(value: any, field?: IField): Record<string, any> {
    return {
      $self: field,
      $form: this,
      $values: this._rawValues(),
      $deps: {},
      $dependencies: {},
      $value: value,
      ...this._scope,
    }
  }

  private _resolveDependencies(
    dependencies: string[] | Record<string, string> | undefined,
    selfPath: string
  ): { deps: Record<string, any>; depsArray: any[] } {
    const deps: Record<string, any> = {}
    const depsArray: any[] = []

    if (!dependencies) return { deps, depsArray }

    if (Array.isArray(dependencies)) {
      // Array form — values accessible via $deps[index]
      for (const depPath of dependencies) {
        const resolvedPath = this._resolveFieldPath(depPath, selfPath)
        const depField = this.fields.get(resolvedPath)
        const value = depField ? depField.value : undefined
        depsArray.push(value)
        deps[depPath] = value
      }
    } else {
      // Object form — values accessible via $deps.alias
      for (const [alias, depPath] of Object.entries(dependencies)) {
        const resolvedPath = this._resolveFieldPath(depPath, selfPath)
        const depField = this.fields.get(resolvedPath)
        const value = depField ? depField.value : undefined
        deps[alias] = value
      }
    }

    return { deps, depsArray }
  }

  // ============================================================
  // Path resolution — supports relative paths and wildcards
  // ============================================================

  private _resolveFieldPath(depPath: string, selfPath: string): string {
    // Relative path starting with '.' — resolve relative to parent
    if (depPath.startsWith('.')) {
      const parts = selfPath.split('.')
      parts.pop() // Remove current field name
      return parts.join('.') + depPath
    }
    return depPath
  }

  // ============================================================
  // Expression evaluation
  // ============================================================

  /**
   * Evaluate a safe expression string with scope variables.
   * Scope includes: $self, $values, $form, $deps, $dependencies, and custom scope.
   */
  private _evalExpressionInScope(expr: string, scope: Record<string, any>): any {
    assertSafeExpression(expr)
    return this._evalUnsafeInScope(expr, scope, false)
  }

  /**
   * Unsafe evaluator used internally after expression safety checks.
   */
  private _evalUnsafeInScope(expr: string, scope: Record<string, any>, statement: boolean): any {
    const keys = Object.keys(scope)
    const values = Object.values(scope)
    const body = statement ? `"use strict"; ${expr}` : `"use strict"; return (${expr})`
    const fn = new Function(...keys, body)
    return fn(...values)
  }

  // ============================================================
  // Expression safety
  // ============================================================

  // ============================================================
  // Internal helpers
  // ============================================================

  private _bumpVersion(): void {
    this._valuesCache = null
    this._rawValuesCache = null
    this._version(this._version() + 1)
  }

  private _disposeReactions(): void {
    for (const dispose of this._reactionDisposers) dispose()
    this._reactionDisposers = []
    this._reactionValueTriggers.clear()
    this._reactionRunners = []
    this._asyncReactionVersions.clear()
    this._fieldLoadingCounts.clear()
  }

  private _getAsyncReactionVersionKey(path: string, reactionKey: string): string {
    return `${path}:${reactionKey}`
  }

  private _beginFieldLoading(field: IField): void {
    const nextCount = (this._fieldLoadingCounts.get(field.path) || 0) + 1
    this._fieldLoadingCounts.set(field.path, nextCount)
    if (nextCount === 1) {
      field.setLoading(true)
    }
  }

  private _endFieldLoading(field: IField): void {
    const currentCount = this._fieldLoadingCounts.get(field.path) || 0
    if (currentCount <= 1) {
      this._fieldLoadingCounts.delete(field.path)
      field.setLoading(false)
      return
    }
    this._fieldLoadingCounts.set(field.path, currentCount - 1)
  }

  private _rawValues(): Record<string, any> {
    if (this._rawValuesCache !== null) return this._rawValuesCache
    const result: Record<string, any> = {}
    for (const [path, field] of this.fields) {
      if (!field.visible) continue
      if (this._isArrayChildPath(path)) continue
      if (field.component && isVoidField(path, this._schema)) continue
      setDeepValue(result, path, field.value)
    }
    this._rawValuesCache = result
    return result
  }

  private _notifyValuesChange(): void {
    const vals = this.values
    for (const listener of this._valuesChangeListeners) {
      listener(vals)
    }
  }
}

// ============================================================
// Factory
// ============================================================

export function createForm(config?: FormConfig): IForm {
  return new Form(config)
}
