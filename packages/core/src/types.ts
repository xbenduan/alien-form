/**
 * @formily-bao/core — Field types and interfaces
 * Full alignment with Formily Schema Protocol
 */

// ============================================================
// Basic Types
// ============================================================

export type FieldValue = any

export type FieldState = 'active' | 'inactive'

export type ValidateStatus = 'success' | 'error' | 'warning' | 'validating' | ''

export type SchemaTypes =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'void'
  | 'date'
  | 'datetime'
  | (string & {})

export type FieldPatternTypes = 'editable' | 'readOnly' | 'disabled' | 'readPretty'

export type FieldDisplayTypes = 'visible' | 'hidden' | 'none'

export type ValidatorFormats =
  | 'email'
  | 'url'
  | 'phone'
  | 'number'
  | 'integer'
  | 'idcard'
  | 'ip'
  | 'ipv6'
  | 'zip'
  | (string & {})

export interface FieldError {
  message: string
  type?: string
}

// ============================================================
// Validator Types
// ============================================================

export interface ValidatorFn {
  (value: any, field: IField): string | undefined | Promise<string | undefined>
}

export type Validator = ValidatorFn | ValidatorRule | ValidatorRule[]

export interface ValidatorRule {
  required?: boolean
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: RegExp | string
  format?: ValidatorFormats
  message?: string
  validator?: ValidatorFn
  // JSON Schema standard validators
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  multipleOf?: number
  maxItems?: number
  minItems?: number
  uniqueItems?: boolean
  const?: any
}

// ============================================================
// Schema Reactions (aligned with Formily protocol)
// ============================================================

export type SchemaReactionEffect =
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

export type SchemaReaction =
  | {
      /** Dependencies — array (read by index via $deps) or object (read by alias) */
      dependencies?: string[] | Record<string, string>
      /** Condition — expression string or boolean */
      when?: string | boolean
      /** Target field path for active mode (supports FormPathPattern, NOT relative paths) */
      target?: string
      /** Lifecycle hooks for active mode */
      effects?: SchemaReactionEffect[]
      /** Branch when condition is met */
      fulfill?: {
        state?: Record<string, any>
        schema?: Record<string, any>
        run?: string
      }
      /** Branch when condition is NOT met */
      otherwise?: {
        state?: Record<string, any>
        schema?: Record<string, any>
        run?: string
      }
    }
  | string  // expression string like "{{myReaction}}"

export type SchemaReactions = SchemaReaction | SchemaReaction[]

// ============================================================
// Async Data Source
// ============================================================

export interface AsyncDataSource {
  url?: string
  method?: 'GET' | 'POST'
  params?: Record<string, any>
  headers?: Record<string, string>
  data?: Record<string, any>
  service?: ((params: Record<string, any>) => Promise<Array<{ label: string; value: any; [key: string]: any }>>) | string
  transformResponse?: ((response: any) => Array<{ label: string; value: any; [key: string]: any }>) | string
  dependencies?: Record<string, string> | string[]
  fetchOnMount?: boolean
}

// ============================================================
// Schema Enum
// ============================================================

export type SchemaEnum = Array<
  | string
  | number
  | { label: any; value: any; [key: string]: any }
  | { key: any; title: any; [key: string]: any }
>

// ============================================================
// Field Mutable State
// ============================================================

export interface FieldMutableState {
  value: any
  visible: boolean
  hidden: boolean
  display: FieldDisplayTypes
  pattern: FieldPatternTypes
  disabled: boolean
  readOnly: boolean
  readPretty: boolean
  editable: boolean
  required: boolean
  title: string
  description: string
  componentProps: Record<string, any>
  decoratorProps: Record<string, any>
  dataSource: Array<{ label: string; value: any; [key: string]: any }>
  loading: boolean
  component: [string, Record<string, any>?]
  decorator: [string, Record<string, any>?]
}

// ============================================================
// IField Interface
// ============================================================

export interface IField {
  path: string
  address: string
  title: string
  description: string
  value: any
  initialValue: any
  display: FieldDisplayTypes
  pattern: FieldPatternTypes
  visible: boolean
  hidden: boolean
  disabled: boolean
  readOnly: boolean
  readPretty: boolean
  editable: boolean
  required: boolean
  errors: FieldError[]
  warnings: FieldError[]
  validateStatus: ValidateStatus
  component: string
  componentProps: Record<string, any>
  decorator: string
  decoratorProps: Record<string, any>
  dataSource: Array<{ label: string; value: any; [key: string]: any }>
  loading: boolean
  data: Record<string, any>
  content: any

  // Methods
  setValue(value: any): void
  setErrors(errors: FieldError[]): void
  setWarnings(warnings: FieldError[]): void
  validate(): Promise<FieldError[]>
  reset(): void
  setState(state: Partial<FieldMutableState>): void
  setDataSource(ds: Array<{ label: string; value: any; [key: string]: any }>): void
  setLoading(loading: boolean): void
  setDisplay(display: FieldDisplayTypes): void
  setPattern(pattern: FieldPatternTypes): void
  setComponent(component: string, props?: Record<string, any>): void
  setDecorator(decorator: string, props?: Record<string, any>): void

  // Array field methods
  isArrayField: boolean
  arrayItems: IField[][]
  push(initialValues?: Record<string, any>): void
  remove(index: number): void
  moveUp(index: number): void
  moveDown(index: number): void

  // Subscriptions
  subscribe(listener: () => void): () => void
}

// ============================================================
// IFieldSchema — JSON Schema with Formily x-* extensions
// ============================================================

export interface IFieldSchema {
  // --- JSON Schema Standard ---
  type?: SchemaTypes
  title?: string
  description?: string
  default?: any
  required?: boolean | string[]
  enum?: SchemaEnum
  const?: any

  // Numeric validators
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  multipleOf?: number

  // String validators
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: ValidatorFormats

  // Array validators
  maxItems?: number
  minItems?: number
  uniqueItems?: boolean

  // Object validators
  maxProperties?: number
  minProperties?: number

  // Structural
  properties?: Record<string, IFieldSchema>
  items?: IFieldSchema | IFieldSchema[]
  additionalItems?: IFieldSchema
  patternProperties?: Record<string, IFieldSchema>
  additionalProperties?: IFieldSchema

  // $ref and definitions
  definitions?: Record<string, IFieldSchema>
  $ref?: string

  // Read/Write
  readOnly?: boolean
  writeOnly?: boolean

  // --- Formily x-* Extensions ---
  'x-index'?: number
  'x-pattern'?: FieldPatternTypes
  'x-display'?: FieldDisplayTypes
  'x-validator'?: Validator | Validator[]
  'x-decorator'?: string
  'x-decorator-props'?: Record<string, any>
  'x-component'?: string
  'x-component-props'?: Record<string, any>
  'x-reactions'?: SchemaReactions
  'x-content'?: any
  'x-visible'?: boolean
  'x-hidden'?: boolean
  'x-disabled'?: boolean
  'x-editable'?: boolean
  'x-read-only'?: boolean
  'x-read-pretty'?: boolean
  'x-data'?: Record<string, any>

  // --- FormBao extensions ---
  'x-data-source'?: Array<{ label: string; value: any; [key: string]: any }>
  'x-async-data-source'?: AsyncDataSource
  'x-layout-props'?: LayoutProps
}

// ============================================================
// Layout Props
// ============================================================

export interface LayoutProps {
  columns?: number
  span?: number
  gap?: number
  direction?: 'horizontal' | 'vertical'
  bordered?: boolean
  collapsible?: boolean
  defaultCollapsed?: boolean
}

// ============================================================
// IFormSchema — root schema
// ============================================================

export interface IFormSchema {
  type: 'object'
  title?: string
  description?: string
  required?: boolean | string[]
  properties?: Record<string, IFieldSchema>
  definitions?: Record<string, IFieldSchema>
}

// ============================================================
// Form Config
// ============================================================

export interface FormConfig {
  initialValues?: Record<string, any>
  validateFirst?: boolean
  effects?: (form: IForm) => void
  /** Custom expression scope variables */
  scope?: Record<string, any>
  /** Service registry for async data sources */
  services?: Record<string, (params: Record<string, any>) => Promise<Array<{ label: string; value: any; [key: string]: any }>>>
  /** Transform response registry for async data sources */
  transformers?: Record<string, (response: any) => Array<{ label: string; value: any; [key: string]: any }>>
}

// ============================================================
// IForm Interface
// ============================================================

export interface IForm {
  fields: Map<string, IField>
  values: Record<string, any>
  initialValues: Record<string, any>
  valid: boolean
  invalid: boolean
  submitting: boolean
  errors: FieldError[]

  // Methods
  createField(path: string, schema: IFieldSchema, initialValue?: any): IField
  getField(path: string): IField | undefined
  setFieldState(path: string, setter: (state: Partial<FieldMutableState>) => void): void
  setValues(values: Record<string, any>): void
  setInitialValues(values: Record<string, any>): void
  reset(): void
  validate(): Promise<boolean>
  submit<T = any>(onSubmit?: (values: Record<string, any>) => T | Promise<T>): Promise<T>
  subscribe(listener: () => void): () => void

  // Schema
  setSchema(schema: IFormSchema): void

  // Array operations
  getArrayField(path: string): IField | undefined
  removeArrayItem(arrayPath: string, index: number): void

  // Lifecycle
  onFieldChange(path: string, listener: (field: IField) => void): () => void
  onValuesChange(listener: (values: Record<string, any>) => void): () => void
}
