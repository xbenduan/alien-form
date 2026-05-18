/**
 * @formily-bao/core — Field implementation using Alien Signals
 * Enterprise schema protocol inspired by Formily
 */

import { signal, effect, startBatch, endBatch } from 'alien-signals'
import type {
  IField,
  FieldError,
  ValidateStatus,
  FieldMutableState,
  IFieldSchema,
  Validator,
  ValidatorRule,
  ValidatorFn,
  SchemaXValidate,
  DataSourcePolicy,
  FieldDisplayTypes,
  FieldPatternTypes,
} from './types'

/**
 * Internal contract used by Field to talk back to its owning Form without
 * creating a circular module import. Form implements every member.
 */
export interface FieldHost {
  fields: Map<string, IField>
  getField(path: string): IField | undefined
  createField(path: string, schema: IFieldSchema, initialValue?: any): IField
  _rebuildReactions?(): void
  _notifyFieldChange?(path: string, field: IField): void
  _notifyFieldValueChange?(path: string, field: IField): void
  _notifyFieldValidateStart?(path: string, field: IField): void
  _notifyFieldValidateEnd?(path: string, field: IField): void
  _notifyFieldValidateFailed?(path: string, field: IField): void
  _notifyFieldValidateSuccess?(path: string, field: IField): void
  _runXValidate?(field: IField, rules: SchemaXValidate, value: any): Promise<FieldError[]>
}

export class Field implements IField {
  // Signals for reactive state
  private _value: ReturnType<typeof signal<any>>
  private _initialValue: any
  private _display: ReturnType<typeof signal<FieldDisplayTypes>>
  private _pattern: ReturnType<typeof signal<FieldPatternTypes>>
  private _required: ReturnType<typeof signal<boolean>>
  private _errors: ReturnType<typeof signal<FieldError[]>>
  private _warnings: ReturnType<typeof signal<FieldError[]>>
  private _validateStatus: ReturnType<typeof signal<ValidateStatus>>
  private _title: ReturnType<typeof signal<string>>
  private _description: ReturnType<typeof signal<string>>
  private _component: ReturnType<typeof signal<string>>
  private _componentProps: ReturnType<typeof signal<Record<string, any>>>
  private _decorator: ReturnType<typeof signal<string>>
  private _decoratorProps: ReturnType<typeof signal<Record<string, any>>>
  private _dataSource: ReturnType<typeof signal<Array<{ label: string; value: any }>>>
  private _loading: ReturnType<typeof signal<boolean>>
  private _data: ReturnType<typeof signal<Record<string, any>>>
  private _content: ReturnType<typeof signal<any>>

  readonly path: string
  readonly address: string
  private _validators: Validator[]
  private _xValidate?: SchemaXValidate
  private _dataSourcePolicy: DataSourcePolicy
  private _reconcilingDataSourceValue = false
  private _listeners: Set<() => void> = new Set()
  private _version: ReturnType<typeof signal<number>>

  // Array field support
  readonly isArrayField: boolean
  private _itemSchema: IFieldSchema | null
  private _arrayRows: ReturnType<typeof signal<number>>
  // Structural reference to the owning form. Defined as an interface so we
  // don't import the Form class (which would create a circular import).
  private _form: FieldHost | null = null

  constructor(path: string, schema: IFieldSchema, initialValue?: any) {
    this.path = path
    this.address = path // In flat model, address equals path

    // Determine if this is an array field
    this.isArrayField = schema.type === 'array' && !!(schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items) && (schema.items as IFieldSchema).properties)
    this._itemSchema = (schema.items && !Array.isArray(schema.items)) ? schema.items as IFieldSchema : null

    const defaultValue = initialValue !== undefined ? initialValue : schema.default
    this._initialValue = defaultValue

    this._value = signal(this.isArrayField ? (Array.isArray(defaultValue) ? defaultValue : []) : defaultValue)

    // Display: visible | hidden | none
    const display: FieldDisplayTypes = schema.state?.display ||
      (schema.state?.visible === false ? 'none' : schema.state?.hidden === true ? 'hidden' : 'visible')
    this._display = signal<FieldDisplayTypes>(display)

    // Pattern: editable | readOnly | disabled | readPretty
    const pattern: FieldPatternTypes = schema.state?.pattern ||
      (schema.state?.readPretty === true ? 'readPretty'
        : schema.state?.readOnly === true || schema.readOnly === true ? 'readOnly'
          : schema.state?.disabled === true ? 'disabled'
            : schema.state?.editable === false ? 'readOnly' : 'editable')
    this._pattern = signal<FieldPatternTypes>(pattern)

    this._required = signal(schema.required === true)
    this._errors = signal<FieldError[]>([])
    this._warnings = signal<FieldError[]>([])
    this._validateStatus = signal<ValidateStatus>('')
    this._title = signal(schema.title || '')
    this._description = signal(schema.description || '')
    this._component = signal(schema.component || 'Input')
    this._componentProps = signal(schema.props || {})
    this._decorator = signal(schema.decorator || 'FormItem')
    this._decoratorProps = signal(schema.decoratorProps || {})
    this._dataSource = signal(normalizeDataSource(schema.dataSource || schema.enum))
    this._dataSourcePolicy = schema.dataSourcePolicy || 'preserve'
    this._loading = signal(false)
    this._data = signal(schema.data || {})
    this._content = signal(schema.content || null)
    this._validators = normalizeValidators([
      ...schemaValidators(schema),
      ...normalizeValidators(schema.validators),
    ])
    this._xValidate = schema['x-validate']
    this._version = signal(0)
    this._arrayRows = signal(this.isArrayField ? (Array.isArray(defaultValue) ? defaultValue.length : 0) : 0)
  }

  // Set form reference (called by Form after creating the field)
  _setForm(form: FieldHost) {
    this._form = form
  }

  // ============================================================
  // Getters — read signals
  // ============================================================

  get value() {
    if (this.isArrayField && this._form && this._itemSchema?.properties) {
      // Dynamically collect values from child fields
      const rowCount = this._arrayRows()
      const result: Record<string, any>[] = []
      for (let i = 0; i < rowCount; i++) {
        const row: Record<string, any> = {}
        for (const key of Object.keys(this._itemSchema.properties)) {
          const childPath = `${this.path}.${i}.${key}`
          const childField = this._form.getField(childPath)
          if (childField) {
            row[key] = childField.value
          }
        }
        result.push(row)
      }
      return result
    }
    return this._value()
  }

  get initialValue() { return this._initialValue }

  // Display types
  get display(): FieldDisplayTypes { return this._display() }
  get visible(): boolean { return this._display() !== 'none' }
  get hidden(): boolean { return this._display() === 'hidden' }

  // Pattern types
  get pattern(): FieldPatternTypes { return this._pattern() }
  get disabled(): boolean { return this._pattern() === 'disabled' }
  get readOnly(): boolean { return this._pattern() === 'readOnly' }
  get readPretty(): boolean { return this._pattern() === 'readPretty' }
  get editable(): boolean { return this._pattern() === 'editable' }

  get required() { return this._required() }
  get errors() { return this._errors() }
  get warnings() { return this._warnings() }
  get validateStatus() { return this._validateStatus() }
  get title() { return this._title() }
  get description() { return this._description() }
  get component() { return this._component() }
  get componentProps() { return this._componentProps() }
  get decorator() { return this._decorator() }
  get decoratorProps() { return this._decoratorProps() }
  get dataSource() { return this._dataSource() }
  get loading() { return this._loading() }
  get data() { return this._data() }
  get content() { return this._content() }

  get arrayItems(): IField[][] {
    if (!this.isArrayField || !this._form) return []
    const rowCount = this._arrayRows()
    const items: IField[][] = []
    for (let i = 0; i < rowCount; i++) {
      const rowFields: IField[] = []
      if (this._itemSchema?.properties) {
        for (const key of Object.keys(this._itemSchema.properties)) {
          const fieldPath = `${this.path}.${i}.${key}`
          const field = this._form.getField(fieldPath)
          if (field) rowFields.push(field)
        }
      }
      items.push(rowFields)
    }
    return items
  }

  // ============================================================
  // Setters — write signals
  // ============================================================

  setValue(value: any): void {
    if (this.isArrayField && this._form && this._itemSchema?.properties) {
      this._setArrayValue(Array.isArray(value) ? value : [])
      return
    }
    this._value(value)
    this._bumpVersion()
    this._notifyValueChange()
  }

  setErrors(errors: FieldError[]): void {
    this._errors(errors)
    this._validateStatus(errors.length > 0 ? 'error' : 'success')
    this._bumpVersion()
  }

  setWarnings(warnings: FieldError[]): void {
    this._warnings(warnings)
    this._bumpVersion()
  }

  setDataSource(ds: Array<{ label: string; value: any; [key: string]: any }>): void {
    this._dataSource(normalizeDataSource(ds))
    this._reconcileValueWithDataSource()
    this._bumpVersion()
  }

  private _reconcileValueWithDataSource(): void {
    if (this._reconcilingDataSourceValue) return

    const policy = this._dataSourcePolicy || 'preserve'
    if (policy === 'preserve') return

    const dataSource = this._dataSource()
    if (dataSource.length === 0) return

    const validValues = new Set(dataSource.map((item) => item.value))
    const current = this.value

    this._reconcilingDataSourceValue = true
    try {
      if (Array.isArray(current)) {
        if (policy === 'filter' || policy === 'clear') {
          const next = current.filter((item) => validValues.has(item))
          if (!arrayShallowEqual(next, current)) {
            this._value(next)
            this._notifyValueChange()
          }
        }
        return
      }

      if (current === undefined || current === null || current === '') return
      if (validValues.has(current)) return

      if (policy === 'clear' || policy === 'filter') {
        this._value(undefined)
        this._notifyValueChange()
      } else if (policy === 'first') {
        this._value(dataSource[0]?.value)
        this._notifyValueChange()
      }
    } finally {
      this._reconcilingDataSourceValue = false
    }
  }

  setLoading(loading: boolean): void {
    this._loading(loading)
    this._bumpVersion()
  }

  setDisplay(display: FieldDisplayTypes): void {
    this._display(display)
    this._bumpVersion()
  }

  setPattern(pattern: FieldPatternTypes): void {
    this._pattern(pattern)
    this._bumpVersion()
  }

  setComponent(component: string, props?: Record<string, any>): void {
    startBatch()
    this._component(component)
    if (props !== undefined) {
      this._componentProps(props)
    }
    this._bumpVersion()
    endBatch()
  }

  setDecorator(decorator: string, props?: Record<string, any>): void {
    startBatch()
    this._decorator(decorator)
    if (props !== undefined) {
      this._decoratorProps(props)
    }
    this._bumpVersion()
    endBatch()
  }

  setState(state: Partial<FieldMutableState>): void {
    startBatch()
    if ('value' in state) this._value(state.value)
    if ('visible' in state) {
      this._display(state.visible ? 'visible' : 'none')
    }
    if ('hidden' in state) {
      if (state.hidden) this._display('hidden')
      else if (this._display() === 'hidden') this._display('visible')
    }
    if ('display' in state) this._display(state.display!)
    if ('pattern' in state) this._pattern(state.pattern!)
    if ('disabled' in state) {
      if (state.disabled) this._pattern('disabled')
      else if (this._pattern() === 'disabled') this._pattern('editable')
    }
    if ('readOnly' in state) {
      if (state.readOnly) this._pattern('readOnly')
      else if (this._pattern() === 'readOnly') this._pattern('editable')
    }
    if ('readPretty' in state) {
      if (state.readPretty) this._pattern('readPretty')
      else if (this._pattern() === 'readPretty') this._pattern('editable')
    }
    if ('editable' in state) {
      this._pattern(state.editable ? 'editable' : 'readOnly')
    }
    if ('required' in state) this._required(state.required!)
    if ('title' in state) this._title(state.title!)
    if ('description' in state) this._description(state.description!)
    if ('componentProps' in state) this._componentProps(state.componentProps!)
    if ('decoratorProps' in state) this._decoratorProps(state.decoratorProps!)
    if ('dataSource' in state) this._dataSource(state.dataSource!)
    if ('loading' in state) this._loading(state.loading!)
    if ('component' in state) {
      this._component(state.component![0])
      if (state.component![1]) this._componentProps(state.component![1])
    }
    if ('decorator' in state) {
      this._decorator(state.decorator![0])
      if (state.decorator![1]) this._decoratorProps(state.decorator![1])
    }
    this._bumpVersion()
    endBatch()
    if ('value' in state || 'visible' in state || 'hidden' in state || 'display' in state) {
      this._notifyValueChange()
    } else {
      this._notifyFieldChange()
    }
  }

  // ============================================================
  // Array field operations
  // ============================================================

  push(initialValues?: Record<string, any>): void {
    if (!this.isArrayField || !this._form || !this._itemSchema?.properties) return

    const currentRows = this._arrayRows()
    const newIndex = currentRows

    this._createRowFields(newIndex, initialValues)

    this._arrayRows(currentRows + 1)
    this._form._rebuildReactions?.()
    this._bumpVersion()
    this._notifyValueChange()
  }

  remove(index: number): void {
    if (!this.isArrayField || !this._form || !this._itemSchema?.properties) return

    const currentRows = this._arrayRows()
    if (index < 0 || index >= currentRows) return

    // Drop the target row's fields (preserve identity for subsequent rows).
    this._deleteRowFields(index)

    // Reindex subsequent rows by renaming in place — keeps Field instances,
    // so subscriptions / errors / dirty state stay attached to the same row.
    for (let i = index + 1; i < currentRows; i++) {
      this._renameRow(i, i - 1)
    }

    this._arrayRows(currentRows - 1)
    this._form._rebuildReactions?.()
    this._bumpVersion()
    this._notifyValueChange()
  }

  /** Internal — rename this field's path/address. Used by array reindex. */
  _renamePath(newPath: string): void {
    ;(this as any).path = newPath
    ;(this as any).address = newPath
  }

  moveUp(index: number): void {
    if (!this.isArrayField || index <= 0) return
    this._swapRows(index, index - 1)
  }

  moveDown(index: number): void {
    if (!this.isArrayField) return
    const currentRows = this._arrayRows()
    if (index >= currentRows - 1) return
    this._swapRows(index, index + 1)
  }

  private _swapRows(indexA: number, indexB: number): void {
    if (!this._form || !this._itemSchema?.properties) return

    if (indexA === indexB) return

    const tempIndex = `__swap__${indexA}_${indexB}_${Date.now()}`
    this._renameRow(indexA, tempIndex)
    this._renameRow(indexB, indexA)
    this._renameRow(tempIndex, indexB)

    this._form._rebuildReactions?.()
    this._bumpVersion()
    this._notifyValueChange()
  }

  private _setArrayValue(value: Record<string, any>[]): void {
    if (!this._form || !this._itemSchema?.properties) return

    const normalizedRows = Array.isArray(value) ? value : []
    const currentRows = this._arrayRows()
    startBatch()

    for (let index = 0; index < normalizedRows.length; index++) {
      const rowValue = normalizedRows[index] || {}
      if (index >= currentRows) {
        this._createRowFields(index, rowValue)
      }
      for (const key of Object.keys(this._itemSchema.properties)) {
        const childPath = `${this.path}.${index}.${key}`
        let childField = this._form.getField(childPath)
        if (!childField) {
          childField = this._form.createField(
            childPath,
            { ...(this._itemSchema.properties[key] as IFieldSchema) },
            rowValue[key]
          )
        }
        childField.setValue(rowValue[key])
      }
    }

    for (let index = currentRows - 1; index >= normalizedRows.length; index--) {
      this._deleteRowFields(index)
    }

    this._arrayRows(normalizedRows.length)
    this._value(normalizedRows)
    if (currentRows !== normalizedRows.length) {
      this._form._rebuildReactions?.()
    }
    this._bumpVersion()
    endBatch()
    this._notifyValueChange()
  }

  private _createRowFields(index: number, initialValues?: Record<string, any>): void {
    if (!this._form || !this._itemSchema?.properties) return
    for (const [key, childSchema] of Object.entries(this._itemSchema.properties)) {
      const fieldPath = `${this.path}.${index}.${key}`
      const initVal = initialValues ? initialValues[key] : undefined
      const schema = { ...childSchema as IFieldSchema }
      this._form.createField(fieldPath, schema, initVal)
    }
  }

  private _deleteRowFields(index: number | string): void {
    if (!this._form) return
    const rowPrefix = `${this.path}.${index}`
    const childPrefix = `${rowPrefix}.`
    for (const fieldPath of Array.from(this._form.fields.keys())) {
      if (fieldPath === rowPrefix || fieldPath.startsWith(childPrefix)) {
        this._form.fields.delete(fieldPath)
      }
    }
  }

  private _renameRow(fromIndex: number | string, toIndex: number | string): void {
    if (!this._form) return
    const fromPrefix = `${this.path}.${fromIndex}`
    const toPrefix = `${this.path}.${toIndex}`
    const movingPaths: string[] = []
    for (const fieldPath of this._form.fields.keys()) {
      if (fieldPath === fromPrefix || fieldPath.startsWith(`${fromPrefix}.`)) {
        movingPaths.push(fieldPath)
      }
    }
    for (const fromPath of movingPaths) {
      const toPath = toPrefix + fromPath.slice(fromPrefix.length)
      const moving = this._form.fields.get(fromPath) as Field | undefined
      if (!moving) continue
      this._form.fields.delete(fromPath)
      moving._renamePath(toPath)
      this._form.fields.set(toPath, moving)
    }
  }

  // ============================================================
  // Validation
  // ============================================================

  async validate(): Promise<FieldError[]> {
    if (this._display() === 'none') return []

    this._form?._notifyFieldValidateStart?.(this.path, this)
    this._validateStatus('validating')
    const errors: FieldError[] = []
    const val = this.value

    // Required check
    if (this._required()) {
      if (isEmptyValue(val)) {
        errors.push({ message: `${this._title() || this.path} is required`, type: 'required' })
      }
    }

    // Run static validators
    for (const validator of this._validators) {
      const errs = await runValidator(validator, val, this)
      if (errs) errors.push(...errs)
    }

    if (this._xValidate && this._form?._runXValidate) {
      const dynamicErrors = await this._form._runXValidate(this, this._xValidate, val)
      if (dynamicErrors.length > 0) errors.push(...dynamicErrors)
    }

    this._errors(errors)
    this._validateStatus(errors.length > 0 ? 'error' : 'success')
    this._bumpVersion()
    if (errors.length > 0) {
      this._form?._notifyFieldValidateFailed?.(this.path, this)
    } else {
      this._form?._notifyFieldValidateSuccess?.(this.path, this)
    }
    this._form?._notifyFieldValidateEnd?.(this.path, this)
    return errors
  }

  reset(): void {
    startBatch()
    this._value(this._initialValue)
    this._errors([])
    this._warnings([])
    this._validateStatus('')
    if (this.isArrayField) {
      this._arrayRows(Array.isArray(this._initialValue) ? this._initialValue.length : 0)
    }
    this._bumpVersion()
    endBatch()
    this._notifyValueChange()
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener)
    const dispose = effect(() => {
      this._version()
      listener()
    })
    return () => {
      this._listeners.delete(listener)
      dispose()
    }
  }

  // Internal — auto-subscribe effect that reads version
  _getVersion() {
    return this._version()
  }

  private _bumpVersion() {
    this._version(this._version() + 1)
  }

  private _notifyValueChange() {
    this._form?._notifyFieldValueChange?.(this.path, this)
  }

  private _notifyFieldChange() {
    this._form?._notifyFieldChange?.(this.path, this)
  }
}

// ============================================================
// Helpers
// ============================================================

function normalizeDataSource(
  ds?: Array<any> | null
): Array<{ label: string; value: any }> {
  if (!ds || !Array.isArray(ds)) return []
  return ds.map((item) => {
    if (typeof item === 'string' || typeof item === 'number') {
      return { label: String(item), value: item }
    }
    // Support { key, title } format (Formily SchemaEnum)
    if (item && 'key' in item && 'title' in item && !('label' in item)) {
      return { label: String(item.title), value: item.key, ...item }
    }
    return item as { label: string; value: any }
  })
}

function arrayShallowEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function normalizeValidators(v?: Validator | Validator[]): Validator[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  return [v]
}

function schemaValidators(schema: IFieldSchema): ValidatorRule[] {
  const rule: ValidatorRule = {}
  if (schema.minimum !== undefined) rule.min = schema.minimum
  if (schema.maximum !== undefined) rule.max = schema.maximum
  if (schema.exclusiveMinimum !== undefined) rule.exclusiveMinimum = schema.exclusiveMinimum
  if (schema.exclusiveMaximum !== undefined) rule.exclusiveMaximum = schema.exclusiveMaximum
  if (schema.multipleOf !== undefined) rule.multipleOf = schema.multipleOf
  if (schema.minLength !== undefined) rule.minLength = schema.minLength
  if (schema.maxLength !== undefined) rule.maxLength = schema.maxLength
  if (schema.pattern !== undefined) rule.pattern = schema.pattern
  if (schema.format !== undefined) rule.format = schema.format
  if (schema.minItems !== undefined) rule.minItems = schema.minItems
  if (schema.maxItems !== undefined) rule.maxItems = schema.maxItems
  if (schema.uniqueItems !== undefined) rule.uniqueItems = schema.uniqueItems
  if (schema.const !== undefined) rule.const = schema.const
  return Object.keys(rule).length > 0 ? [rule] : []
}

function isEmptyValue(value: any): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
}

async function runValidator(
  validator: Validator,
  value: any,
  field: IField
): Promise<FieldError[] | null> {
  if (typeof validator === 'function') {
    const msg = await (validator as ValidatorFn)(value, field)
    return msg ? [{ message: msg }] : null
  }

  const rules = Array.isArray(validator) ? validator : [validator]
  const errors: FieldError[] = []

  for (const rule of rules) {
    const r = rule as ValidatorRule
    if (r.validator) {
      const msg = await r.validator(value, field)
      if (msg) errors.push({ message: msg })
      continue
    }
    if (r.required && isEmptyValue(value)) {
      errors.push({ message: r.message || `Field is required`, type: 'required' })
    }
    if (r.min !== undefined && typeof value === 'number' && value < r.min) {
      errors.push({ message: r.message || `Must be >= ${r.min}`, type: 'min' })
    }
    if (r.max !== undefined && typeof value === 'number' && value > r.max) {
      errors.push({ message: r.message || `Must be <= ${r.max}`, type: 'max' })
    }
    if (r.exclusiveMinimum !== undefined && typeof value === 'number' && value <= r.exclusiveMinimum) {
      errors.push({ message: r.message || `Must be > ${r.exclusiveMinimum}`, type: 'exclusiveMinimum' })
    }
    if (r.exclusiveMaximum !== undefined && typeof value === 'number' && value >= r.exclusiveMaximum) {
      errors.push({ message: r.message || `Must be < ${r.exclusiveMaximum}`, type: 'exclusiveMaximum' })
    }
    if (r.multipleOf !== undefined && typeof value === 'number' && value % r.multipleOf !== 0) {
      errors.push({ message: r.message || `Must be a multiple of ${r.multipleOf}`, type: 'multipleOf' })
    }
    if (r.minLength !== undefined && typeof value === 'string' && value.length < r.minLength) {
      errors.push({ message: r.message || `Min length: ${r.minLength}`, type: 'minLength' })
    }
    if (r.maxLength !== undefined && typeof value === 'string' && value.length > r.maxLength) {
      errors.push({ message: r.message || `Max length: ${r.maxLength}`, type: 'maxLength' })
    }
    if (r.minItems !== undefined && Array.isArray(value) && value.length < r.minItems) {
      errors.push({ message: r.message || `Minimum ${r.minItems} items`, type: 'minItems' })
    }
    if (r.maxItems !== undefined && Array.isArray(value) && value.length > r.maxItems) {
      errors.push({ message: r.message || `Maximum ${r.maxItems} items`, type: 'maxItems' })
    }
    if (r.uniqueItems && Array.isArray(value)) {
      const unique = new Set(value.map((v: any) => JSON.stringify(v)))
      if (unique.size !== value.length) {
        errors.push({ message: r.message || `Items must be unique`, type: 'uniqueItems' })
      }
    }
    if (r.const !== undefined && value !== r.const) {
      errors.push({ message: r.message || `Must equal ${JSON.stringify(r.const)}`, type: 'const' })
    }
    if (r.pattern) {
      const regex = typeof r.pattern === 'string' ? new RegExp(r.pattern) : r.pattern
      if (value && !regex.test(String(value))) {
        errors.push({ message: r.message || `Invalid format`, type: 'pattern' })
      }
    }
    if (r.format && value) {
      const formatError = validateFormat(r.format, value, r.message)
      if (formatError) errors.push(formatError)
    }
  }

  return errors.length > 0 ? errors : null
}

function validateFormat(format: string, value: any, message?: string): FieldError | null {
  const str = String(value)
  switch (format) {
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
        return { message: message || 'Invalid email', type: 'format' }
      }
      break
    case 'url':
      if (!/^https?:\/\/.+/.test(str)) {
        return { message: message || 'Invalid URL', type: 'format' }
      }
      break
    case 'phone':
      if (!/^[\d\s\-+()]+$/.test(str)) {
        return { message: message || 'Invalid phone number', type: 'format' }
      }
      break
    case 'number':
      if (isNaN(Number(str))) {
        return { message: message || 'Must be a number', type: 'format' }
      }
      break
    case 'integer':
      if (!/^-?\d+$/.test(str)) {
        return { message: message || 'Must be an integer', type: 'format' }
      }
      break
    case 'idcard':
      if (!/^(\d{15}|\d{17}[\dXx])$/.test(str)) {
        return { message: message || 'Invalid ID card number', type: 'format' }
      }
      break
    case 'ip':
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(str)) {
        return { message: message || 'Invalid IP address', type: 'format' }
      }
      break
    case 'ipv6':
      if (!/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(str) &&
          !/^(([0-9a-fA-F]{1,4}:)*):?(([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4})?$/.test(str)) {
        return { message: message || 'Invalid IPv6 address', type: 'format' }
      }
      break
    case 'zip':
      if (!/^\d{5,6}$/.test(str)) {
        return { message: message || 'Invalid zip code', type: 'format' }
      }
      break
  }
  return null
}
