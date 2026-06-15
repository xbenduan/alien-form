/**
 * @alien-form/core — Type definitions
 * Value-capability runtime architecture
 */

// ─── Signal Types ─────────────────────────────────────────────────────────────

/** A readable/writable signal: call with no args to read, with one arg to write. */
export type Signal<T> = {
  (): T;
  (value: T): void;
};

/** A read-only computed signal: call with no args to read. */
export type Computed<T> = () => T;

// ─── Basic Types ──────────────────────────────────────────────────────────────

export type ValidateStatus = "success" | "error" | "warning" | "validating" | "";
export type PrimitiveSchemaType = "string" | "number" | "boolean";
export type SchemaTypes = PrimitiveSchemaType | "object" | "array" | "void" | (string & {});
export type FieldKind = "primitive" | "object" | "array" | "void";
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

export type SchemaReactionKey =
  | "value" | "rows" | "display" | "disabled" | "required"
  | "title" | "description" | "props" | "decoratorProps"
  | "component" | "decorator" | "dataSource";

export type RuntimeExecutable = (ctx: RuntimeRuleContext, form: FormInstance) => any | Promise<any>;
export type SchemaRuntimeValue = string | number | boolean | null | undefined | Record<string, any> | any[] | RuntimeExecutable;
export type SchemaReactions = Partial<Record<SchemaReactionKey | string, SchemaRuntimeValue | SchemaRuntimeValue[]>>;
export type SchemaEffect = SchemaRuntimeValue | SchemaRuntimeValue[];
export interface SchemaFormat { input?: SchemaRuntimeValue; output?: SchemaRuntimeValue; }
export type SchemaXValidate = SchemaRuntimeValue | SchemaRuntimeValue[];

export interface RuntimeRuleContext {
  field: FieldNode;
  form: FormInstance;
  path: string;
  key?: string;
  kind: "x-reaction" | "x-effect" | "x-format" | "x-validate";
  schema: IFieldSchema | IFormSchema;
  row?: RowNode;
  scope: Record<string, any>;
  values: Record<string, any>;
  value?: any;
  get(selector: string): any;
  set(selector: string, value: any): void;
  project(selector?: string): any;
  effect(runner: () => void | (() => void)): () => void;
}

export type RuntimeRuleHandler = RuntimeExecutable;

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
  decorator?: string;
  decoratorProps?: Record<string, any>;
  component?: string;
  props?: Record<string, any>;
  "x-reaction"?: SchemaReactions;
  "x-effect"?: SchemaEffect;
  "x-format"?: SchemaFormat;
  "x-validate"?: SchemaXValidate;
  dataSource?: DataSourceItem[];
  // 数据源策略：保留/清空/过滤/第一个选项
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
  "x-reaction"?: SchemaReactions;
  "x-effect"?: SchemaEffect;
}

// ─── FieldNode — value-capability runtime nodes ───────────────────────────────

export interface BaseFieldNode {
  id: string;
  path: string;
  schema: IFieldSchema;
  kind: FieldKind;
  parent?: FieldNode;
  row?: RowNode;
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
  _disposers: (() => void)[];
  dispose(): void;
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
}

export interface PrimitiveFieldNode extends BaseFieldNode {
  kind: "primitive";
  value: Signal<any>;
  setValue(value: any): void;
}

export interface ObjectFieldNode extends BaseFieldNode {
  kind: "object";
  children: Map<string, FieldNode>;
}

export interface ArrayFieldNode extends BaseFieldNode {
  kind: "array";
  rows: Signal<RowNode[]>;
  push(initialValues?: any): void;
  remove(index: number): void;
  move(from: number, to: number): void;
  moveUp(index: number): void;
  moveDown(index: number): void;
  setRows(values: any[]): void;
}

export interface VoidFieldNode extends BaseFieldNode {
  kind: "void";
  children: Map<string, FieldNode>;
}

export interface RowNode {
  id: string;
  index: number;
  path: string;
  parent: ArrayFieldNode;
  children: Map<string, FieldNode>;
}

export type FieldNode = PrimitiveFieldNode | ObjectFieldNode | ArrayFieldNode | VoidFieldNode;
export type FieldAtoms = FieldNode;

// ─── FormConfig ───────────────────────────────────────────────────────────────

export type FormErrorScope = "reaction" | "x-reaction" | "x-effect" | "x-format" | "x-validate" | "ref-resolve" | "expression";

export interface FormError {
  scope: FormErrorScope;
  path: string;
  key?: string;
  message: string;
  cause?: unknown;
}

export interface FormConfig {
  schema?: IFormSchema;
  definitions?: Record<string, IFieldSchema>;
  initialValues?: Record<string, any>;
  scope?: Record<string, any>;
  handlers?: Record<string, RuntimeRuleHandler>;
  onError?: (error: FormError) => void;
}

// ─── FormInstance ─────────────────────────────────────────────────────────────

export interface FormInstance {
  schema: IFormSchema;
  root: ObjectFieldNode;
  fields: Signal<Map<string, FieldNode>>;
  submitting: Signal<boolean>;
  values: Computed<Record<string, any>>;
  errors: Computed<FieldError[]>;
  valid: Computed<boolean>;

  field(path: string): FieldNode | undefined;
  get(selector: string): any;
  set(selector: string, value: any): void;
  project(selector?: string): any;
  setValues(values: Record<string, any>): void;
  setInitialValues(values: Record<string, any>): void;
  reset(): void;
  mount(): void;
  unmount(): void;
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
