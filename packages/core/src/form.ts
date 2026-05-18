/**
 * @formily-bao/core — Form model implementation
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
  SchemaReactions,
  SchemaReactionRule,
  SchemaReactionKey,
  FieldMutableState,
} from './types'

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
  private _schema: IFormSchema | null = null
  private _reactionDisposers: Array<() => void> = []
  private _reactionValueTriggers: Map<string, Set<() => void>> = new Map()
  private _actionCache: Map<string, string> = new Map()
  private _config: FormConfig
  private _scope: Record<string, any>
  private _lifecycle: LifecycleRegistry
  private _definitions: Record<string, IFieldSchema> = {}

  constructor(config: FormConfig = {}) {
    this._config = config
    this._initialValues = config.initialValues ? { ...config.initialValues } : {}
    this._submitting = signal(false)
    this._version = signal(0)
    this._scope = config.scope || {}
    this._lifecycle = createLifecycleRegistry()

    if (config.effects) {
      config.effects(this)
    }
  }

  // ============================================================
  // Computed properties
  // ============================================================

  get values(): Record<string, any> {
    const result: Record<string, any> = {}
    for (const [path, field] of this.fields) {
      if (!field.visible) continue
      // Skip array child fields — they are part of the array field's value
      if (this._isArrayChildPath(path)) continue
      // Skip void fields — they are layout containers
      if (field.component && isVoidField(path, this._schema)) continue
      setDeepValue(result, path, field.value)
    }
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
    const initVal = initialValue !== undefined ? initialValue : getDeepValue(this._initialValues, path)
    const field = new Field(path, schema, initVal)
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
        field.setValue(val)
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
    // Dispose previous reactions
    for (const dispose of this._reactionDisposers) dispose()
    this._reactionDisposers = []
    this._reactionValueTriggers.clear()
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
    parentRequired?: boolean | string[]
  ): void {
    // Sort entries by order
    const sortedEntries = Object.entries(properties).sort(([, a], [, b]) => {
      const ai = a.order ?? Infinity
      const bi = b.order ?? Infinity
      return ai - bi
    })

    for (const [key, rawSchema] of sortedEntries) {
      const path = prefix ? `${prefix}.${key}` : key

      // Resolve $ref
      const schema = this._resolveRef(rawSchema)

      // Resolve required from parent
      const isRequired = schema.required === true ||
        (Array.isArray(parentRequired) && parentRequired.includes(key))

      if (schema.type === 'array' && schema.items) {
        const itemSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items
        if (itemSchema && typeof itemSchema === 'object' && (itemSchema as IFieldSchema).properties) {
          // Array field — create the array field itself
          const field = this.createField(path, { ...schema, required: isRequired })
          // Initialize rows from initial values
          const initialArr = getDeepValue(this._initialValues, path)
          if (Array.isArray(initialArr)) {
            const itemProps = (itemSchema as IFieldSchema).properties!
            for (let i = 0; i < initialArr.length; i++) {
              for (const [childKey, childSchema] of Object.entries(itemProps)) {
                const childPath = `${path}.${i}.${childKey}`
                const childInitVal = initialArr[i]?.[childKey]
                this.createField(childPath, this._resolveRef(childSchema as IFieldSchema), childInitVal)
              }
            }
          }
        } else {
          // Simple array (e.g., array of strings)
          this.createField(path, { ...schema, required: isRequired })
        }
      } else if (schema.type === 'object' && schema.properties) {
        if (schema.component) {
          this.createField(path, { ...schema, required: isRequired })
        }
        this._createFieldsFromSchema(path, schema.properties, schema.required)
      } else if (schema.type === 'void') {
        // Void nodes are layout containers — create them if they have component
        if (schema.component) {
          this.createField(path, { ...schema, required: false })
        }
        if (schema.properties) {
          this._createFieldsFromSchema(path, schema.properties, schema.required)
        }
      } else {
        this.createField(path, { ...schema, required: isRequired })
      }
    }
  }

  // ============================================================
  // $ref and definitions resolution
  // ============================================================

  private _resolveRef(schema: IFieldSchema): IFieldSchema {
    if (!schema.$ref) return schema
    // $ref format: "#/definitions/Name"
    const refPath = schema.$ref.replace(/^#\/definitions\//, '')
    const resolved = this._definitions[refPath]
    if (!resolved) {
      console.warn(`[formily-bao] Could not resolve $ref: ${schema.$ref}`)
      return schema
    }
    // Merge: schema props override $ref props (local overrides)
    const { $ref, ...localProps } = schema
    return { ...this._resolveRef(resolved), ...localProps }
  }

  // ============================================================
  // Reaction system
  // ============================================================

  private _setupReactions(schema: IFormSchema): void {
    if (!schema.properties) return
    this._setupFieldReactions('', schema.properties)
  }

  private _setupFieldReactions(prefix: string, properties: Record<string, IFieldSchema>): void {
    for (const [key, schema] of Object.entries(properties)) {
      const path = prefix ? `${prefix}.${key}` : key
      const reactions = schema.reactions

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
          this._setupFieldReactions(path, (itemSchema as IFieldSchema).properties!)
        }
      }
    }
  }

  private _setupPropertyReaction(selfPath: string, reactionKey: string, rule: SchemaReactionRule): void {
    const runner = () => {
      const field = this.fields.get(selfPath)
      if (!field) return

      const { deps, depsArray } = this._resolveDependencies(rule.dependencies, selfPath)
      const scope = this._buildScope(field, deps, depsArray)
      void this._runPropertyReaction(field, reactionKey, rule, scope)
    }

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

  private _getReactionDependencyPaths(rule: SchemaReactionRule, selfPath: string): string[] {
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
    rule: SchemaReactionRule,
    scope: Record<string, any>
  ): void {
    try {
      const value = this._resolveReactionValue(field, reactionKey, rule, scope)
      if (isPromiseLike(value)) {
        void value
          .then((resolved) => {
            this._applyReactionValue(field, reactionKey, resolved)
          })
          .catch((err) => {
            console.warn(`[formily-bao] reaction "${reactionKey}" error for "${field.path}":`, err)
          })
        return
      }
      this._applyReactionValue(field, reactionKey, value)
    } catch (err) {
      console.warn(`[formily-bao] reaction "${reactionKey}" error for "${field.path}":`, err)
    }
  }

  private _resolveReactionValue(
    field: IField,
    reactionKey: string,
    rule: SchemaReactionRule,
    scope: Record<string, any>
  ): any {
    switch (rule.type) {
      case 'static':
        return rule.value
      case 'expression':
        return this._evalExpressionInScope(rule.expression, scope)
      case 'match': {
        const source = rule.source
          ? this._evalExpressionInScope(rule.source, scope)
          : this._defaultMatchSource(scope)
        const key = source === undefined || source === null ? 'default' : String(source)
        return Object.prototype.hasOwnProperty.call(rule.match, key)
          ? rule.match[key]
          : rule.match.default
      }
      case 'computed': {
        const handler = this._config.reactionHandlers?.[rule.handler]
        if (!handler) return undefined
        field.setLoading(true)
        const result = handler({
          field,
          form: this,
          values: this.values,
          deps: scope.$dependencies,
          dependencies: scope.$dependencies,
          scope,
          key: reactionKey,
          rule,
        })
        if (isPromiseLike(result)) {
          return result.finally(() => {
            field.setLoading(false)
          })
        }
        field.setLoading(false)
        return result
      }
    }
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
        console.warn(`[formily-bao] unsupported reaction key "${reactionKey}" for "${field.path}"`)
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
      // User custom scope
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
    this._version(this._version() + 1)
  }

  private _notifyValuesChange(): void {
    const vals = this.values
    for (const listener of this._valuesChangeListeners) {
      listener(vals)
    }
  }
}


// ============================================================
// Expression safety
// ============================================================

const UNSAFE_EXPRESSION_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /(^|[^.$\w])(?:globalThis|window|document|process|Function|eval|constructor|prototype|__proto__)(?=$|[^$\w])/u, message: 'global or reflective access is not allowed' },
  { pattern: /=>|function|class|new/u, message: 'function/class construction is not allowed' },
  { pattern: /(?:^|[^=!<>])=(?!=)/u, message: 'assignment is not allowed in expressions' },
  { pattern: /;|`/u, message: 'statements and template literals are not allowed in expressions' },
]

function assertSafeExpression(expr: string): void {
  for (const rule of UNSAFE_EXPRESSION_PATTERNS) {
    if (rule.pattern.test(expr)) {
      throw new Error(`Unsafe expression rejected: ${rule.message}`)
    }
  }
}

// ============================================================
// Utility functions
// ============================================================

function getDeepValue(obj: Record<string, any>, path: string): any {
  const keys = path.split('.')
  let current: any = obj
  for (const key of keys) {
    if (current === undefined || current === null) return undefined
    current = current[key]
  }
  return current
}

function setDeepValue(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.')
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    // If next key is a number, create an array; otherwise object
    if (!(key in current) || typeof current[key] !== 'object') {
      const nextKey = keys[i + 1]
      current[key] = /^\d+$/.test(nextKey) ? [] : {}
    }
    current = current[key]
  }
  current[keys[keys.length - 1]] = value
}

function isPromiseLike(value: any): value is Promise<any> {
  return !!value && typeof value.then === 'function'
}

function normalizeDataSource(ds?: Array<any> | null): Array<{ label: string; value: any; [key: string]: any }> {
  if (!ds || !Array.isArray(ds)) return []
  return ds.map((item) => {
    if (typeof item === 'string' || typeof item === 'number') {
      return { label: String(item), value: item }
    }
    if (item && 'key' in item && 'title' in item && !('label' in item)) {
      return { label: String(item.title), value: item.key, ...item }
    }
    return item as { label: string; value: any; [key: string]: any }
  })
}

/**
 * Sort schema properties by order
 */
function sortByOrder(properties: Record<string, IFieldSchema>): Record<string, IFieldSchema> {
  const entries = Object.entries(properties)
  entries.sort(([, a], [, b]) => {
    const ai = a.order ?? Infinity
    const bi = b.order ?? Infinity
    return ai - bi
  })
  return Object.fromEntries(entries)
}

/**
 * Check if a field path refers to a void-type schema node
 */
function isVoidField(path: string, schema: IFormSchema | null): boolean {
  if (!schema?.properties) return false
  const parts = path.split('.')
  let current: Record<string, IFieldSchema> | undefined = schema.properties
  for (let i = 0; i < parts.length; i++) {
    if (!current) return false
    const fs: IFieldSchema | undefined = current[parts[i]]
    if (!fs) return false
    if (i === parts.length - 1) {
      return fs.type === 'void'
    }
    current = fs.properties
  }
  return false
}

// ============================================================
// Factory
// ============================================================

export function createForm(config?: FormConfig): IForm {
  return new Form(config)
}
