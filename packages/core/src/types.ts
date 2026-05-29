/**
 * @alien-form/core — Type definitions
 * Atomic signal-per-property architecture
 */

// ─── Signal Types ─────────────────────────────────────────────────────────────
// alien-signals does NOT export Signal/Computed as named types.
// We define them here to match the actual return types of signal() and computed().

/** A readable/writable signal: call with no args to read, with one arg to write. */
export type Signal<T> = {
  (): T;
  (value: T): void;
};

/** A read-only computed signal: call with no args to read. */
export type Computed<T> = () => T;

// ─── Basic Types ──────────────────────────────────────────────────────────────

export type ValidateStatus = "success" | "error" | "warning" | "validating" | "";
export type SchemaTypes = "string" | "number" | "boolean" | "object" | "array" | "void" | (string & {});
export type FieldDisplayTypes = "visible" | "hidden" | "none";
export type ValidatorFormats = "email" | "url" | "phone" | "number" | "integer" | "idcard" | "ip" | "ipv6" | "zip" | (string & {});
export type DataSourcePolicy = "preserve" | "clear" | "filter" | "first";

export interface FieldError {
  message: string;
  type?: string;
}

export interface DataSourceItem {
  label: string;
  value: any;
  [key: string]: any;
}

// ─── Schema Validate ──────────────────────────────────────────────────────────

export interface SchemaValidate {
  required?: boolean;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: ValidatorFormats;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  const?: any;
  message?: string;
}

// ─── Schema Reactions ─────────────────────────────────────────────────────────

export type SchemaReactionKey =
  | "value" | "display" | "disabled" | "required"
  | "title" | "description" | "props" | "decoratorProps"
  | "component" | "decorator" | "dataSource";

export interface RuntimeRuleHandlerContext {
  field: FieldAtoms;
  form: FormInstance;
  values: Record<string, any>;
  deps: Record<string, any>;
  dependencies: Record<string, any>;
  scope: Record<string, any>;
  key: string;
  rule: SchemaXRule;
  value?: any;
  kind?: "x-reaction" | "x-format" | "x-validate";
}

export type RuntimeRuleHandler = (context: RuntimeRuleHandlerContext) => any | Promise<any>;

export type SchemaXRule =
  | { type: "static"; dependencies?: string[] | Record<string, string>; value: any }
  | { type: "expression"; dependencies?: string[] | Record<string, string>; expression: string }
  | { type: "match"; dependencies?: string[] | Record<string, string>; source?: string; match: Record<string, any> }
  | { type: "computed"; dependencies?: string[] | Record<string, string>; handler: string; params?: Record<string, any> };

export type SchemaRuleSet = SchemaXRule | SchemaXRule[];
export type SchemaReactions = Partial<Record<SchemaReactionKey | string, SchemaRuleSet>>;
export interface SchemaFormat { input?: SchemaRuleSet; output?: SchemaRuleSet; }
export type SchemaXValidate = SchemaRuleSet;

// ─── IFieldSchema ─────────────────────────────────────────────────────────────

export interface IFieldSchema {
  type?: SchemaTypes;
  title?: string;
  description?: string;
  default?: any;
  properties?: Record<string, IFieldSchema>;
  items?: IFieldSchema | IFieldSchema[];
  $ref?: string;
  order?: number;
  required?: boolean | string[];
  display?: FieldDisplayTypes;
  disabled?: boolean;
  validate?: SchemaValidate;
  decorator?: string;
  decoratorProps?: Record<string, any>;
  component?: string;
  props?: Record<string, any>;
  "x-reaction"?: SchemaReactions;
  "x-format"?: SchemaFormat;
  "x-validate"?: SchemaXValidate;
  dataSource?: DataSourceItem[];
  dataSourcePolicy?: DataSourcePolicy;
}

// ─── IFormSchema ──────────────────────────────────────────────────────────────

export interface IFormSchema {
  type: "object";
  title?: string;
  description?: string;
  required?: boolean | string[];
  properties?: Record<string, IFieldSchema>;
  definitions?: Record<string, IFieldSchema>;
}

// ─── FieldAtoms — the core atomic unit ────────────────────────────────────────

export interface FieldAtoms {
  path: string;
  schema: IFieldSchema;
  // Each property is an independent signal
  value: Signal<any>;
  display: Signal<FieldDisplayTypes>;
  disabled: Signal<boolean>;
  required: Signal<boolean>;
  errors: Signal<FieldError[]>;
  warnings: Signal<FieldError[]>;
  validateStatus: Signal<ValidateStatus>;
  title: Signal<string>;
  description: Signal<string>;
  component: Signal<string>;
  componentProps: Signal<Record<string, any>>;
  decorator: Signal<string>;
  decoratorProps: Signal<Record<string, any>>;
  dataSource: Signal<DataSourceItem[]>;
  loading: Signal<boolean>;
  // Array
  isArrayField: boolean;
  arrayRows: Signal<number>;
  // Lifecycle
  _disposers: (() => void)[];
  dispose(): void;
  // Methods
  setValue(value: any): void;
  setErrors(errors: FieldError[]): void;
  setWarnings(warnings: FieldError[]): void;
  setDisplay(display: FieldDisplayTypes): void;
  setDisabled(value: boolean): void;
  setRequired(value: boolean): void;
  setLoading(loading: boolean): void;
  setDataSource(ds: DataSourceItem[]): void;
  setComponent(component: string, props?: Record<string, any>): void;
  setDecorator(decorator: string, props?: Record<string, any>): void;
  validate(): Promise<FieldError[]>;
  reset(): void;
  // Array methods
  push(initialValues?: any): void;
  remove(index: number): void;
  moveUp(index: number): void;
  moveDown(index: number): void;
}

// ─── FormConfig ───────────────────────────────────────────────────────────────

export type FormErrorScope = "reaction" | "x-reaction" | "x-format" | "x-validate" | "ref-resolve" | "expression";

export interface FormError {
  scope: FormErrorScope;
  path: string;
  key?: string;
  message: string;
  cause?: unknown;
}

export interface FormConfig {
  schema?: IFormSchema;
  initialValues?: Record<string, any>;
  validateFirst?: boolean;
  setup?: (form: FormInstance) => void | (() => void);
  scope?: Record<string, any>;
  handlers?: Record<string, RuntimeRuleHandler>;
  onError?: (error: FormError) => void;
}

// ─── FormInstance ─────────────────────────────────────────────────────────────

export interface FormInstance {
  // The schema this form was created with
  schema: IFormSchema;
  // Atomic signals
  fields: Signal<Map<string, FieldAtoms>>;
  submitting: Signal<boolean>;
  values: Computed<Record<string, any>>;
  errors: Computed<FieldError[]>;
  valid: Computed<boolean>;

  // Methods
  field(path: string): FieldAtoms | undefined;
  setValues(values: Record<string, any>): void;
  setInitialValues(values: Record<string, any>): void;
  reset(): void;
  validate(): Promise<boolean>;
  submit<T = any>(onSubmit?: (values: Record<string, any>) => T | Promise<T>): Promise<T>;
  destroy(): void;
  onError(listener: (error: FormError) => void): () => void;
  effect(runner: (form: FormInstance) => void | (() => void)): () => void;
  effect<T>(
    selector: (form: FormInstance) => T,
    listener: (value: T, prev: T | undefined) => void,
    options?: { immediate?: boolean; equals?: (a: T, b: T) => boolean },
  ): () => void;
}
