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

export interface DataSourceItem {
  label: string;
  value: any;
  [key: string]: any;
}

export type RuntimeAccessor<T = any> = (code: string) => T;
export type RuntimeNamespace<T = any> = Readonly<Record<string, T>>;
export type NamePath = string | readonly (string | number)[];
export type PermissionAction = "read" | "create" | "update" | "delete";
export type SchemaSlots = Record<string, Record<string, IFieldSchema>>;

// ─── Schema Validate ──────────────────────────────────────────────────────────

export type SchemaReactionKey =
  | "value"
  | "rows"
  | "display"
  | "disabled"
  | "required"
  | "title"
  | "description"
  | "props"
  | "decoratorProps"
  | "component"
  | "decorator"
  | "dataSource";

export interface ExpressionScope {
  mode?: string;
  $self: FieldNode;
  $form: FormInstance;
  $value: any;
  $row: Record<string, any> | undefined;
  $path: string;
  $service: RuntimeAccessor;
  $utils: RuntimeNamespace;
  $enums: RuntimeNamespace;
  $query: Record<string, any>;
}

export type RuntimeExecutable = (scope: ExpressionScope) => any | Promise<any>;
export type SchemaRuntimeValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, any>
  | any[]
  | RuntimeExecutable;
export type SchemaReactions = Partial<
  Record<SchemaReactionKey | string, SchemaRuntimeValue | SchemaRuntimeValue[]>
>;
export type SchemaEffect = SchemaRuntimeValue | SchemaRuntimeValue[];
export interface SchemaFormat {
  input?: SchemaRuntimeValue;
  output?: SchemaRuntimeValue;
}
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
  value?: any;
  getFieldValue(path: NamePath): any;
  setFieldValue(path: NamePath, value: any): void;
  effect(runner: () => void | (() => void)): () => void;
}

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
  slots?: SchemaSlots;
  permission?: PermissionAction;
  "x-reaction"?: SchemaReactions;
  "x-effect"?: SchemaEffect;
  "x-format"?: SchemaFormat;
  "x-validate"?: SchemaXValidate;
  dataSource?: SchemaRuntimeValue;
}

// ─── IFormSchema ──────────────────────────────────────────────────────────────

export interface IFormSchema {
  type: "object";
  title?: string;
  description?: string;
  required?: boolean | string[];
  component?: string;
  props?: Record<string, any>;
  properties?: Record<string, IFieldSchema>;
  definitions?: Record<string, IFieldSchema>;
  "x-reaction"?: SchemaReactions;
  "x-effect"?: SchemaEffect;
}

// ─── FieldNode — value-capability runtime nodes ───────────────────────────────

export interface BaseFieldNode {
  id: string;
  readonly path: string;
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
  title: Signal<string | undefined>;
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
  readonly children: ReadonlyMap<string, FieldNode>;
}

export interface ArrayFieldNode extends BaseFieldNode {
  kind: "array";
  rows: Computed<RowNode[]>;
  push(initialValues?: any): void;
  remove(index: number): void;
  move(from: number, to: number): void;
  moveUp(index: number): void;
  moveDown(index: number): void;
  setRows(values: any[]): void;
}

export interface VoidFieldNode extends BaseFieldNode {
  kind: "void";
  readonly children: ReadonlyMap<string, FieldNode>;
}

export interface RowNode {
  id: string;
  readonly index: number;
  readonly path: string;
  parent: ArrayFieldNode;
  readonly children: ReadonlyMap<string, FieldNode>;
}

export type FieldNode = PrimitiveFieldNode | ObjectFieldNode | ArrayFieldNode | VoidFieldNode;
export type FieldAtoms = FieldNode;

// ─── FormConfig ───────────────────────────────────────────────────────────────

export type FormErrorScope =
  | "reaction"
  | "x-reaction"
  | "x-effect"
  | "x-format"
  | "x-validate"
  | "ref-resolve"
  | "expression";

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
  onError?: (error: FormError) => void;
}

// ─── FormInstance ─────────────────────────────────────────────────────────────

export interface FormInstance {
  schema: IFormSchema;
  /** 运行时上下文：供表达式和 UI 组件读取场景、服务等环境信息。 */
  scope: Record<string, any>;
  /** 当前运行时值的深冻结、非响应式快照，不执行 x-format.output。 */
  readonly data: Readonly<Record<string, any>>;
  root: ObjectFieldNode;
  fields: Computed<Map<string, FieldNode>>;
  submitting: Signal<boolean>;
  errors: Computed<FieldError[]>;
  valid: Computed<boolean>;

  field(path: NamePath): FieldNode | undefined;
  getFieldValue(path: NamePath): any;
  setFieldValue(path: NamePath, value: any): void;
  getFieldsValue(paths?: readonly NamePath[]): Record<string, any>;
  setFieldsValue(values: Record<string, any>): void;
  getOutput(): Readonly<Record<string, any>>;
  setInitialValues(values: Record<string, any>): void;
  setScope(values: Record<string, any>): void;
  resetFields(paths?: readonly NamePath[]): void;
  mount(): void;
  unmount(): void;
  validate(names?: readonly NamePath[]): Promise<boolean>;
  validateFast(): Promise<boolean>;
  getFieldsValueFast(): Record<string, any>;
  submit<T = any>(onSubmit?: (values: Record<string, any>) => T | Promise<T>): Promise<T>;
  destroy(): void;
  _registerField(field: FieldNode): void;
  _unregisterField(field: FieldNode): void;
  onError(listener: (error: FormError) => void): () => void;
  effect(runner: (form: FormInstance) => void | (() => void)): () => void;
  effect<T>(
    selector: (form: FormInstance) => T,
    listener: (value: T, prev: T | undefined) => void,
    options?: { immediate?: boolean; equals?: (a: T, b: T) => boolean },
  ): () => void;
}
