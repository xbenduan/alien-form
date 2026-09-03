import type { CompiledExpression, IFieldSchema, IFormSchema } from "@alien-form/core";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type OpenMode = "page" | "drawer" | "modal";

export type DatabaseColumnType = "text" | "integer" | "real" | "boolean" | "json";
export type DatabaseValueType = "string" | "number" | "boolean" | "object" | "array";
export type DatabaseRelationKind = "many-to-one" | "many-to-many";

export interface DatabaseRelation {
  kind: DatabaseRelationKind;
  target: string;
  through?: string;
  valueField?: string;
  labelField?: string;
}

/** 物理表字段（存储真相源）。数组顺序即列序/表单序。 */
export interface DatabaseField {
  /** 字段键名，同时作为默认列名与 form-schema 的对应 key。 */
  key: string;
  title?: string;
  column?: string;
  type: DatabaseColumnType;
  valueType?: DatabaseValueType;
  /** 系统字段：构建器禁止编辑/删除其存储定义。 */
  system?: boolean;
  nullable?: boolean;
  default?: string | number | boolean;
  unique?: boolean;
  index?: boolean;
  /** table 列的静态初始可见性，默认 true。 */
  visible?: boolean;
  /** 是否可作为筛选条件。 */
  filterable?: boolean;
  sortable?: boolean;
  relation?: DatabaseRelation;
}

export interface ModelMeta {
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  group?: string;
  singularLabel?: string;
  pluralLabel?: string;
  defaultPageSize?: number;
}

export interface FieldGroup {
  component?: string;
  keys: string[];
  title?: string;
  description?: string;
  props?: Record<string, unknown>;
}

export interface FieldSchema extends Omit<IFieldSchema, "properties" | "items" | "props"> {
  properties?: Record<string, FieldSchema>;
  items?: FieldSchema | FieldSchema[];
  props?: Record<string, unknown>;
  group?: FieldGroup[];
}

export interface XPage {
  router: string;
  title?: string;
  layout?: {
    component: string;
    props?: Record<string, unknown>;
  };
  properties: Record<string, FieldSchema>;
}

export interface BuilderSchema {
  meta: ModelMeta;
  /** 物理表定义，唯一存储真相源。 */
  fields: DatabaseField[];
  pages: XPage[];
  definitions: {
    "form-schema": FieldSchema;
    [key: string]: FieldSchema;
  };
}

export interface CompiledValue {
  readonly expression: CompiledExpression;
}

export interface CompiledNode {
  key: string;
  schema: FieldSchema;
  props: Record<string, unknown>;
  slots: Record<string, CompiledNode | CompiledNode[]>;
  children: CompiledNode[];
}

export interface CompiledPage {
  router: string;
  title: string;
  schema: IFormSchema;
  nodes: CompiledNode[];
}
