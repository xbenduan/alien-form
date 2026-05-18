/**
 * @formily-bao/core — Form model implementation
 * Fully aligned with Formily Schema Protocol
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
  SchemaReaction,
  SchemaReactions,
  AsyncDataSource,
  FieldMutableState,
  SchemaReactionEffect,
} from './types'

// ============================================================
// Lifecycle event types
// ============================================================

type LifecycleHandler = (field: IField, form: IForm) => void

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
  private _asyncDisposers: Array<() => void> = []
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
    for (const dispose of this._asyncDisposers) dispose()
    this._asyncDisposers = []
    this.fields.clear()

    // Resolve $ref and definitions
    this._definitions = schema.definitions || {}

    if (schema.properties) {
      // Sort by x-index before creating fields
      const sortedProperties = sortByXIndex(schema.properties)
      this._createFieldsFromSchema('', sortedProperties, schema.required)
    }
    // Setup reactions after all fields created
    this._setupReactions(schema)
    // Setup async data sources
    this._setupAsyncDataSources(schema)
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

  // Formily-style lifecycle registration (used in effects)
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
    // Sort entries by x-index
    const sortedEntries = Object.entries(properties).sort(([, a], [, b]) => {
      const ai = a['x-index'] ?? Infinity
      const bi = b['x-index'] ?? Infinity
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
        if (schema['x-component']) {
          this.createField(path, { ...schema, required: isRequired })
        }
        this._createFieldsFromSchema(path, schema.properties, schema.required)
      } else if (schema.type === 'void') {
        // Void nodes are layout containers — create them if they have x-component
        if (schema['x-component']) {
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
  // Reaction system — Full Formily protocol
  // ============================================================

  private _setupReactions(schema: IFormSchema): void {
    if (!schema.properties) return
    this._setupFieldReactions('', schema.properties)
  }

  private _setupFieldReactions(prefix: string, properties: Record<string, IFieldSchema>): void {
    for (const [key, rawSchema] of Object.entries(properties)) {
      const path = prefix ? `${prefix}.${key}` : key
      const schema = this._resolveRef(rawSchema)
      const reactions = schema['x-reactions']

      if (reactions) {
        const reactionList = Array.isArray(reactions) ? reactions : [reactions]
        for (const reaction of reactionList) {
          if (typeof reaction === 'string') {
            // Expression string like "{{myReaction}}" — passive mode
            this._setupExpressionReaction(path, reaction)
          } else {
            if (reaction.target) {
              // Active mode — this field's reaction targets another field
              this._setupActiveReaction(path, reaction)
            } else {
              // Passive mode — this field reacts to dependencies
              this._setupPassiveReaction(path, reaction)
            }
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

  /**
   * Passive mode: the field with x-reactions reacts to its dependencies
   * The field itself is the target
   */
  private _setupPassiveReaction(selfPath: string, reaction: Exclude<SchemaReaction, string>): void {
    const dispose = effect(() => {
      const selfField = this.fields.get(selfPath)
      if (!selfField) return

      // Resolve dependencies
      const { deps, depsArray } = this._resolveDependencies(reaction.dependencies, selfPath)

      // Build scope
      const scope = this._buildScope(selfField, deps, depsArray, selfField)

      // Evaluate condition
      const conditionMet = this._evaluateCondition(reaction.when, scope)

      // Apply branch
      const branch = conditionMet ? reaction.fulfill : reaction.otherwise
      if (branch) {
        this._applyBranch(branch, selfField, scope)
      }
    })

    this._reactionDisposers.push(dispose)
  }

  /**
   * Active mode: reaction on field A targets field B
   * The target is specified in reaction.target
   */
  private _setupActiveReaction(selfPath: string, reaction: Exclude<SchemaReaction, string>): void {
    const dispose = effect(() => {
      const selfField = this.fields.get(selfPath)
      if (!selfField) return

      // Resolve the target field path
      const targetPath = this._resolveFieldPath(reaction.target!, selfPath)
      const targetField = this.fields.get(targetPath)
      if (!targetField) return

      // Resolve dependencies
      const { deps, depsArray } = this._resolveDependencies(reaction.dependencies, selfPath)

      // Build scope with $target
      const scope = this._buildScope(selfField, deps, depsArray, targetField)

      // Handle effects/lifecycle hooks
      if (reaction.effects && reaction.effects.length > 0) {
        // Register lifecycle handlers — effects are only triggered on specific events
        // For now, we evaluate immediately and let the effect system handle re-runs
      }

      // Evaluate condition
      const conditionMet = this._evaluateCondition(reaction.when, scope)

      // Apply branch to TARGET
      const branch = conditionMet ? reaction.fulfill : reaction.otherwise
      if (branch) {
        this._applyBranch(branch, targetField, scope)
      }
    })

    this._reactionDisposers.push(dispose)
  }

  /**
   * Expression string reaction: "{{expression}}"
   */
  private _setupExpressionReaction(selfPath: string, expression: string): void {
    const dispose = effect(() => {
      const selfField = this.fields.get(selfPath)
      if (!selfField) return

      const scope = this._buildScope(selfField, {}, [], selfField)

      try {
        const compiled = this._compileExpression(expression)
        compiled(scope)
      } catch (err) {
        console.warn(`[formily-bao] Expression reaction error for "${selfPath}":`, err)
      }
    })

    this._reactionDisposers.push(dispose)
  }

  // ============================================================
  // Scope building — $self, $values, $form, $deps, $dependencies, $target
  // ============================================================

  private _buildScope(
    selfField: IField,
    deps: Record<string, any>,
    depsArray: any[],
    targetField: IField
  ): Record<string, any> {
    return {
      // Formily built-in scope variables
      $self: selfField,
      $form: this,
      $values: this.values,
      $deps: depsArray.length > 0 ? depsArray : deps,
      $dependencies: deps,
      $target: targetField,
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

  private _resolveFieldPath(targetPath: string, selfPath: string): string {
    // Relative path starting with '.' — resolve relative to parent
    if (targetPath.startsWith('.')) {
      const parts = selfPath.split('.')
      parts.pop() // Remove current field name
      return parts.join('.') + targetPath
    }
    return targetPath
  }

  // ============================================================
  // Condition evaluation
  // ============================================================

  private _evaluateCondition(
    when: string | boolean | undefined,
    scope: Record<string, any>
  ): boolean {
    if (when === undefined) return true
    if (typeof when === 'boolean') return when

    // Strip {{ }} wrapper if present
    let expr = when.trim()
    if (expr.startsWith('{{') && expr.endsWith('}}')) {
      expr = expr.slice(2, -2).trim()
    }

    try {
      return Boolean(this._evalInScope(expr, scope))
    } catch {
      return false
    }
  }

  // ============================================================
  // Branch application — state / schema / run
  // ============================================================

  private _applyBranch(
    branch: { state?: Record<string, any>; schema?: Record<string, any>; run?: string },
    targetField: IField,
    scope: Record<string, any>
  ): void {
    // Apply state changes
    if (branch.state) {
      const resolvedState: Record<string, any> = {}
      for (const [key, value] of Object.entries(branch.state)) {
        if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
          // Expression in state value
          try {
            resolvedState[key] = this._evalInScope(value.slice(2, -2), scope)
          } catch {
            resolvedState[key] = value
          }
        } else {
          resolvedState[key] = value
        }
      }
      targetField.setState(resolvedState as Partial<FieldMutableState>)
    }

    // Apply schema changes (x-component-props, x-decorator-props, title, etc.)
    if (branch.schema) {
      const schemaUpdate = branch.schema
      const stateFromSchema: Partial<FieldMutableState> = {}

      if ('x-component-props' in schemaUpdate) {
        stateFromSchema.componentProps = {
          ...targetField.componentProps,
          ...schemaUpdate['x-component-props'],
        }
      }
      if ('x-decorator-props' in schemaUpdate) {
        stateFromSchema.decoratorProps = {
          ...targetField.decoratorProps,
          ...schemaUpdate['x-decorator-props'],
        }
      }
      if ('title' in schemaUpdate) {
        stateFromSchema.title = schemaUpdate.title
      }
      if ('description' in schemaUpdate) {
        stateFromSchema.description = schemaUpdate.description
      }
      if ('x-visible' in schemaUpdate) {
        stateFromSchema.visible = schemaUpdate['x-visible']
      }
      if ('x-hidden' in schemaUpdate) {
        stateFromSchema.hidden = schemaUpdate['x-hidden']
      }
      if ('x-disabled' in schemaUpdate) {
        stateFromSchema.disabled = schemaUpdate['x-disabled']
      }
      if ('x-display' in schemaUpdate) {
        stateFromSchema.display = schemaUpdate['x-display']
      }
      if ('x-pattern' in schemaUpdate) {
        stateFromSchema.pattern = schemaUpdate['x-pattern']
      }
      if ('enum' in schemaUpdate || 'x-data-source' in schemaUpdate) {
        const ds = schemaUpdate['x-data-source'] || schemaUpdate['enum']
        if (Array.isArray(ds)) {
          stateFromSchema.dataSource = ds.map((item: any) => {
            if (typeof item === 'string' || typeof item === 'number') {
              return { label: String(item), value: item }
            }
            return item
          })
        }
      }
      if ('required' in schemaUpdate) {
        stateFromSchema.required = schemaUpdate.required
      }
      if ('x-component' in schemaUpdate) {
        stateFromSchema.component = [schemaUpdate['x-component'], schemaUpdate['x-component-props']]
      }
      if ('x-decorator' in schemaUpdate) {
        stateFromSchema.decorator = [schemaUpdate['x-decorator'], schemaUpdate['x-decorator-props']]
      }

      if (Object.keys(stateFromSchema).length > 0) {
        targetField.setState(stateFromSchema)
      }
    }

    // Execute run statement
    if (branch.run) {
      try {
        this._evalInScope(branch.run, scope)
      } catch (err) {
        console.warn('[formily-bao] run statement error:', err)
      }
    }
  }

  // ============================================================
  // Expression compilation engine
  // ============================================================

  /**
   * Compile a {{expression}} template string
   * Returns a function that executes with the given scope
   */
  private _compileExpression(template: string): (scope: Record<string, any>) => any {
    // Strip {{ }} wrapper
    const expr = template.replace(/^\{\{/, '').replace(/\}\}$/, '').trim()
    return (scope: Record<string, any>) => {
      return this._evalInScope(expr, scope)
    }
  }

  /**
   * Evaluate an expression string with scope variables
   * Scope includes: $self, $values, $form, $deps, $dependencies, $target, and custom scope
   */
  private _evalInScope(expr: string, scope: Record<string, any>): any {
    const keys = Object.keys(scope)
    const values = Object.values(scope)

    // Create a function with scope variables as parameters
    try {
      const fn = new Function(...keys, `"use strict"; return (${expr})`)
      return fn(...values)
    } catch {
      // Try as statement (for `run` which may contain assignments, function calls, etc.)
      try {
        const fn = new Function(...keys, `"use strict"; ${expr}`)
        return fn(...values)
      } catch (err) {
        throw err
      }
    }
  }

  // ============================================================
  // Async Data Source
  // ============================================================

  private _setupAsyncDataSources(schema: IFormSchema): void {
    if (!schema.properties) return
    this._setupAsyncFieldDataSources('', schema.properties)
  }

  private _setupAsyncFieldDataSources(prefix: string, properties: Record<string, IFieldSchema>): void {
    for (const [key, rawSchema] of Object.entries(properties)) {
      const path = prefix ? `${prefix}.${key}` : key
      const schema = this._resolveRef(rawSchema)
      const asyncDs = schema['x-async-data-source']

      if (asyncDs) {
        this._setupSingleAsyncDataSource(path, asyncDs)
      }

      // Recurse
      if (schema.properties) {
        this._setupAsyncFieldDataSources(path, schema.properties)
      }
    }
  }

  private _setupSingleAsyncDataSource(targetPath: string, config: AsyncDataSource): void {
    const field = this.fields.get(targetPath)
    if (!field) return

    let hasFetched = false

    const doFetch = async (deps: Record<string, any>) => {
      field.setLoading(true)
      try {
        let result: Array<{ label: string; value: any }>

        if (config.service) {
          if (typeof config.service === 'function') {
            result = await config.service(deps)
          } else if (typeof config.service === 'string' && this._config.services?.[config.service]) {
            result = await this._config.services[config.service](deps)
          } else {
            result = []
          }
        } else if (config.url) {
          const url = resolveTemplate(config.url, deps)
          const options: RequestInit = {
            method: config.method || 'GET',
            headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
          }
          if (config.method === 'POST' && config.data) {
            options.body = JSON.stringify(resolveTemplateObject(config.data, deps))
          }
          const response = await fetch(url, options)
          if (!response.ok) {
            throw new Error(`Async data source request failed: ${response.status} ${response.statusText}`)
          }
          const json = await response.json()

          if (config.transformResponse) {
            if (typeof config.transformResponse === 'function') {
              result = config.transformResponse(json)
            } else if (typeof config.transformResponse === 'string' && this._config.transformers?.[config.transformResponse]) {
              result = this._config.transformers[config.transformResponse](json)
            } else {
              result = json
            }
          } else {
            result = json
          }
        } else {
          result = []
        }

        field.setDataSource(result)
      } catch (err) {
        console.error(`[formily-bao] Async data source error for "${targetPath}":`, err)
        field.setDataSource([])
      } finally {
        field.setLoading(false)
      }
    }

    if (config.dependencies) {
      const dispose = effect(() => {
        const deps: Record<string, any> = {}
        if (Array.isArray(config.dependencies)) {
          for (const depPath of config.dependencies) {
            const depField = this.fields.get(depPath)
            if (depField) deps[depPath] = depField.value
          }
        } else if (config.dependencies) {
          for (const [alias, depPath] of Object.entries(config.dependencies)) {
            const depField = this.fields.get(depPath)
            if (depField) deps[alias] = depField.value
          }
        }

        const hasValue = Object.values(deps).some((v) => v !== undefined && v !== null && v !== '')
        if (hasValue || (!hasFetched && config.fetchOnMount !== false)) {
          hasFetched = true
          doFetch(deps)
        }
      })
      this._asyncDisposers.push(dispose)
    } else if (config.fetchOnMount !== false) {
      doFetch({})
    }
  }

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

function resolveTemplate(template: string, deps: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return deps[key] !== undefined ? String(deps[key]) : ''
  })
}

function resolveTemplateObject(obj: Record<string, any>, deps: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = resolveTemplate(value, deps)
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Sort schema properties by x-index
 */
function sortByXIndex(properties: Record<string, IFieldSchema>): Record<string, IFieldSchema> {
  const entries = Object.entries(properties)
  entries.sort(([, a], [, b]) => {
    const ai = a['x-index'] ?? Infinity
    const bi = b['x-index'] ?? Infinity
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
