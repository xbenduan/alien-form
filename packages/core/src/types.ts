/**
 * @alien-form/core — Field types and interfaces
 * Enterprise schema protocol inspired by Formily
 */

// ============================================================
// Basic Types
// ============================================================

export type FieldValue = any;

export type FieldState = "active" | "inactive";

export type ValidateStatus = "success" | "error" | "warning" | "validating" | "";

export type SchemaTypes =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "void"
  | "date"
  | "datetime"
  | (string & {});

export type FieldPatternTypes = "editable" | "readOnly" | "disabled" | "readPretty";

export type FieldDisplayTypes = "visible" | "hidden" | "none";

export type ValidatorFormats =
  | "email"
  | "url"
  | "phone"
  | "number"
  | "integer"
  | "idcard"
  | "ip"
  | "ipv6"
  | "zip"
  | (string & {});

export interface FieldError {
  message: string;
  type?: string;
}

// ============================================================
// Lifecycle Types
// ============================================================

export type FormLifecycleEvent =
  | "onFieldInit"
  | "onFieldMount"
  | "onFieldUnmount"
  | "onFieldValueChange"
  | "onFieldInputValueChange"
  | "onFieldInitialValueChange"
  | "onFieldValidateStart"
  | "onFieldValidateEnd"
  | "onFieldValidateFailed"
  | "onFieldValidateSuccess";

export type FormLifecycleHandler = (field: IField, form: IForm) => void;

// ============================================================
// Validator Types
// ============================================================

export interface ValidatorFn {
  (value: any, field: IField): string | undefined | Promise<string | undefined>;
}

export type Validator = ValidatorFn | ValidatorRule | ValidatorRule[];

export interface ValidatorRule {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp | string;
  format?: ValidatorFormats;
  message?: string;
  validator?: ValidatorFn;
  // JSON Schema standard validators
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  const?: any;
}

// ============================================================
// Schema Reactions
// ============================================================

export type SchemaXRuleType = "static" | "expression" | "match" | "computed";

export type SchemaReactionKey =
  | "value"
  | "display"
  | "visible"
  | "hidden"
  | "pattern"
  | "disabled"
  | "readOnly"
  | "readPretty"
  | "editable"
  | "required"
  | "title"
  | "description"
  | "props"
  | "decoratorProps"
  | "component"
  | "decorator"
  | "dataSource";

export interface RuntimeRuleHandlerContext {
  field: IField;
  form: IForm;
  values: Record<string, any>;
  deps: Record<string, any>;
  dependencies: Record<string, any>;
  scope: Record<string, any>;
  key: SchemaReactionKey | "input" | "output" | "validate" | string;
  rule: SchemaXRule;
  value?: any;
  kind?: "x-reaction" | "x-format" | "x-validate";
}

export type RuntimeRuleHandler = (context: RuntimeRuleHandlerContext) => any | Promise<any>;
export type SchemaXRule =
  | {
      type: "static";
      dependencies?: string[] | Record<string, string>;
      value: any;
    }
  | {
      type: "expression";
      dependencies?: string[] | Record<string, string>;
      expression: string;
    }
  | {
      type: "match";
      dependencies?: string[] | Record<string, string>;
      source?: string;
      match: Record<string, any>;
    }
  | {
      type: "computed";
      dependencies?: string[] | Record<string, string>;
      handler: string;
      params?: Record<string, any>;
    };

export type SchemaRule = SchemaXRule;
export type SchemaRuleSet = SchemaXRule | SchemaXRule[];
export type SchemaReactions = Partial<Record<SchemaReactionKey | string, SchemaRuleSet>>;
export interface SchemaFormat {
  input?: SchemaRuleSet;
  output?: SchemaRuleSet;
}
export type SchemaXValidate = SchemaRuleSet;

// ============================================================
// Field Mutable State
// ============================================================

export interface FieldMutableState {
  value: any;
  visible: boolean;
  hidden: boolean;
  display: FieldDisplayTypes;
  pattern: FieldPatternTypes;
  disabled: boolean;
  readOnly: boolean;
  readPretty: boolean;
  editable: boolean;
  required: boolean;
  title: string;
  description: string;
  componentProps: Record<string, any>;
  decoratorProps: Record<string, any>;
  dataSource: Array<{ label: string; value: any; [key: string]: any }>;
  loading: boolean;
  component: [string, Record<string, any>?];
  decorator: [string, Record<string, any>?];
}

// ============================================================
// IField Interface
// ============================================================

export interface IField {
  path: string;
  address: string;
  title: string;
  description: string;
  value: any;
  initialValue: any;
  display: FieldDisplayTypes;
  pattern: FieldPatternTypes;
  visible: boolean;
  hidden: boolean;
  disabled: boolean;
  readOnly: boolean;
  readPretty: boolean;
  editable: boolean;
  required: boolean;
  errors: FieldError[];
  warnings: FieldError[];
  validateStatus: ValidateStatus;
  component: string;
  componentProps: Record<string, any>;
  decorator: string;
  decoratorProps: Record<string, any>;
  dataSource: Array<{ label: string; value: any; [key: string]: any }>;
  loading: boolean;
  data: Record<string, any>;
  content: any;

  // Methods
  setValue(value: any): void;
  setErrors(errors: FieldError[]): void;
  setWarnings(warnings: FieldError[]): void;
  validate(): Promise<FieldError[]>;
  reset(): void;
  setState(state: Partial<FieldMutableState>): void;
  setDataSource(ds: Array<{ label: string; value: any; [key: string]: any }>): void;
  setLoading(loading: boolean): void;
  setDisplay(display: FieldDisplayTypes): void;
  setPattern(pattern: FieldPatternTypes): void;
  setComponent(component: string, props?: Record<string, any>): void;
  setDecorator(decorator: string, props?: Record<string, any>): void;

  // Array field methods
  isArrayField: boolean;
  arrayItems: IField[][];
  push(initialValues?: any): void;
  remove(index: number): void;
  moveUp(index: number): void;
  moveDown(index: number): void;

  // Subscriptions
  subscribe(listener: () => void): () => void;
  effect(runner: (field: IField) => void): () => void;
  watch<T>(
    selector: (field: IField) => T,
    listener: (value: T, prevValue: T | undefined) => void,
    options?: WatchOptions<T>,
  ): () => void;
}

// ============================================================
// IFieldSchema — JSON Schema with AlienForm schema protocol fields
// ============================================================

export type DataSourcePolicy = "preserve" | "clear" | "filter" | "first";

export interface IFieldSchema {
  // --- JSON Schema Standard ---
  type?: SchemaTypes;
  title?: string;
  description?: string;
  default?: any;
  required?: boolean | string[];
  const?: any;

  // Numeric validators
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;

  // String validators
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: ValidatorFormats;

  // Array validators
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;

  // Structural
  properties?: Record<string, IFieldSchema>;
  items?: IFieldSchema | IFieldSchema[];

  // $ref only supports root-level definitions on IFormSchema
  $ref?: string;

  // --- AlienForm Schema Protocol ---
  order?: number;
  state?: Partial<
    Pick<
      FieldMutableState,
      "display" | "pattern" | "disabled" | "readOnly" | "readPretty" | "editable"
    >
  >;
  validators?: Validator | Validator[];
  decorator?: string;
  decoratorProps?: Record<string, any>;
  component?: string;
  props?: Record<string, any>;
  /** Dynamic field-property derivations. */
  "x-reaction"?: SchemaReactions;
  /** Input/output value formatting rules. */
  "x-format"?: SchemaFormat;
  /** Dynamic validation rule derivation. */
  "x-validate"?: SchemaXValidate;
  content?: any;
  data?: Record<string, any>;
  dataSource?: Array<{ label: string; value: any; [key: string]: any }>;
  dataSourcePolicy?: DataSourcePolicy;
}

// ============================================================
// IFormSchema — root schema
// ============================================================

export interface IFormSchema {
  type: "object";
  title?: string;
  description?: string;
  required?: boolean | string[];
  properties?: Record<string, IFieldSchema>;
  definitions?: Record<string, IFieldSchema>;
}

// ============================================================
// Form Config
// ============================================================

export interface FormConfig {
  initialValues?: Record<string, any>;
  validateFirst?: boolean;
  effects?: (form: IForm) => void;
  setup?: (form: IForm) => void | (() => void);
  /** Custom constants/data injected into expression and rule runtime scope. Functions belong in computed handlers. */
  scope?: Record<string, any>;
  /** Registered computed handlers for x-reaction, x-format and x-validate */
  handlers?: Record<string, RuntimeRuleHandler>;
  /** Subscribe to non-fatal runtime errors (reaction/format/validator/ref). */
  onError?: (error: FormError) => void;
}

// ============================================================
// FormError — surface non-fatal errors from reactions/format/validators
// ============================================================

export type FormErrorScope =
  | "reaction"
  | "x-reaction"
  | "x-format"
  | "x-validate"
  | "ref-resolve"
  | "expression";

export interface FormError {
  scope: FormErrorScope;
  /** Field path that owns the rule, or '' for form-level errors. */
  path: string;
  /** Optional reaction key (e.g. 'visible', 'title') or rule kind. */
  key?: string;
  message: string;
  cause?: unknown;
}

// ============================================================
// IForm Interface
// ============================================================

export interface WatchOptions<T> {
  immediate?: boolean;
  equals?: (prev: T, next: T) => boolean;
}

export interface WatchContext {
  form: IForm;
  stop: () => void;
}

export interface IForm {
  fields: Map<string, IField>;
  values: Record<string, any>;
  initialValues: Record<string, any>;
  valid: boolean;
  invalid: boolean;
  submitting: boolean;
  errors: FieldError[];

  // Methods
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

  // Schema
  setSchema(schema: IFormSchema): void;

  // Array operations
  getArrayField(path: string): IField | undefined;
  removeArrayItem(arrayPath: string, index: number): void;

  // Signals-style effects
  effect(runner: (form: IForm) => void): () => void;
  watch<T>(
    selector: (form: IForm) => T,
    listener: (value: T, prevValue: T | undefined, ctx: WatchContext) => void,
    options?: WatchOptions<T>,
  ): () => void;
  watchFieldValue<T = any>(
    path: string,
    listener: (value: T, prevValue: T | undefined, ctx: WatchContext) => void,
    options?: WatchOptions<T>,
  ): () => void;
  watchValues(
    listener: (
      values: Record<string, any>,
      prevValues: Record<string, any> | undefined,
      ctx: WatchContext,
    ) => void,
    options?: WatchOptions<Record<string, any>>,
  ): () => void;

  // Subscriptions
  onFieldChange(path: string, listener: (field: IField) => void): () => void;
  onValuesChange(listener: (values: Record<string, any>) => void): () => void;
  onError(listener: (error: FormError) => void): () => void;
  onLifecycle(event: FormLifecycleEvent, path: string, handler: FormLifecycleHandler): () => void;
}
