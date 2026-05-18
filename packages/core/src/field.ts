/**
 * @formily-bao/core — Field implementation using Alien Signals
 * Fully aligned with Formily Schema Protocol
 */

import { signal, computed, effect, startBatch, endBatch } from 'alien-signals'
import type {
  IField,
  FieldError,
  ValidateStatus,
  FieldMutableState,
  IFieldSchema,
  Validator,
  ValidatorRule,
  ValidatorFn,
  FieldDisplayTypes,
  FieldPatternTypes,
} from './types'

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
  private _listeners: Set<() => void> = new Set()
  private _version: ReturnType<typeof signal<number>>

  // Array field support
  readonly isArrayField: boolean
  private _itemSchema: IFieldSchema | null
  private _arrayRows: ReturnType<typeof signal<number>>
  private _form: any // reference to parent form, set externally

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
    const display: FieldDisplayTypes = schema['x-display'] ||
      (schema['x-visible'] === false ? 'none' : schema['x-hidden'] === true ? 'hidden' : 'visible')
    this._display = signal<FieldDisplayTypes>(display)

    // Pattern: editable | readOnly | disabled | readPretty
    const pattern: FieldPatternTypes = schema['x-pattern'] ||
      (schema['x-read-pretty'] === true ? 'readPretty'
        : schema['x-read-only'] === true || schema.readOnly === true ? 'readOnly'
          : schema['x-disabled'] === true ? 'disabled'
            : schema['x-editable'] === false ? 'readOnly' : 'editable')
    this._pattern = signal<FieldPatternTypes>(pattern)

    this._required = signal(schema.required === true)
    this._errors = signal<FieldError[]>([])
    this._warnings = signal<FieldError[]>([])
    this._validateStatus = signal<ValidateStatus>('')
    this._title = signal(schema.title || '')
    this._description = signal(schema.description || '')
    this._component = signal(schema['x-component'] || 'Input')
    this._componentProps = signal(schema['x-component-props'] || {})
    this._decorator = signal(schema['x-decorator'] || 'FormItem')
    this._decoratorProps = signal(schema['x-decorator-props'] || {})
    this._dataSource = signal(normalizeDataSource(schema['x-data-source'] || schema.enum))
    this._loading = signal(false)
    this._data = signal(schema['x-data'] || {})
    this._content = signal(schema['x-content'] || null)
    this._validators = normalizeValidators(schema['x-validator'])
    this._version = signal(0)
    this._arrayRows = signal(this.isArrayField ? (Array.isArray(defaultValue) ? defaultValue.length : 0) : 0)
  }

  // Set form reference (called by Form after creating the field)
  _setForm(form: any) {
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
    this._value(value)
    this._bumpVersion()
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
    this._dataSource(ds)
    this._bumpVersion()
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
  }

  // ============================================================
  // Array field operations
  // ============================================================

  push(initialValues?: Record<string, any>): void {
    if (!this.isArrayField || !this._form || !this._itemSchema?.properties) return

    const currentRows = this._arrayRows()
    const newIndex = currentRows

    // Create child fields for the new row
    for (const [key, childSchema] of Object.entries(this._itemSchema.properties)) {
      const fieldPath = `${this.path}.${newIndex}.${key}`
      const initVal = initialValues ? initialValues[key] : undefined
      const schema = { ...childSchema as IFieldSchema }
      this._form.createField(fieldPath, schema, initVal)
    }

    this._arrayRows(currentRows + 1)
    this._bumpVersion()
  }

  remove(index: number): void {
    if (!this.isArrayField || !this._form || !this._itemSchema?.properties) return

    const currentRows = this._arrayRows()
    if (index < 0 || index >= currentRows) return

    const properties = this._itemSchema.properties
    // Remove fields for deleted row
    for (const key of Object.keys(properties)) {
      const fieldPath = `${this.path}.${index}.${key}`
      this._form.fields.delete(fieldPath)
    }

    // Reindex subsequent rows
    for (let i = index + 1; i < currentRows; i++) {
      for (const key of Object.keys(properties)) {
        const oldPath = `${this.path}.${i}.${key}`
        const newPath = `${this.path}.${i - 1}.${key}`
        const field = this._form.fields.get(oldPath)
        if (field) {
          this._form.fields.delete(oldPath)
          const childSchema = properties[key] as IFieldSchema
          this._form.createField(newPath, childSchema, field.value)
        }
      }
    }

    // Remove last row's fields (now duplicated)
    const lastIdx = currentRows - 1
    for (const key of Object.keys(properties)) {
      const fieldPath = `${this.path}.${lastIdx}.${key}`
      this._form.fields.delete(fieldPath)
    }

    this._arrayRows(currentRows - 1)
    this._bumpVersion()
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

    const properties = this._itemSchema.properties
    for (const key of Object.keys(properties)) {
      const pathA = `${this.path}.${indexA}.${key}`
      const pathB = `${this.path}.${indexB}.${key}`
      const fieldA = this._form.getField(pathA)
      const fieldB = this._form.getField(pathB)
      if (fieldA && fieldB) {
        const tempValue = fieldA.value
        fieldA.setValue(fieldB.value)
        fieldB.setValue(tempValue)
      }
    }

    this._bumpVersion()
  }

  // ============================================================
  // Validation
  // ============================================================

  async validate(): Promise<FieldError[]> {
    if (this._display() === 'none') return []

    this._validateStatus('validating')
    const errors: FieldError[] = []

    // Required check
    if (this._required()) {
      const val = this._value()
      if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
        errors.push({ message: `${this._title() || this.path} is required`, type: 'required' })
      }
    }

    // Run validators
    for (const validator of this._validators) {
      const errs = await runValidator(validator, this._value(), this)
      if (errs) errors.push(...errs)
    }

    this._errors(errors)
    this._validateStatus(errors.length > 0 ? 'error' : 'success')
    this._bumpVersion()
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

function normalizeValidators(v?: Validator | Validator[]): Validator[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  return [v]
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
    if (r.required && (value === undefined || value === null || value === '')) {
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
