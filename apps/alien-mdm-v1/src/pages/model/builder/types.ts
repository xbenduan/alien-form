import type {
  BuilderSchema,
  DatabaseColumnType,
  DatabaseRelation,
  DatabaseValueType,
  FieldGroup,
  FieldSchema,
  OpenMode,
} from "@engine";

/** 表单类型（含不落库的 void 纯展示元素）。 */
export type FieldType = DatabaseValueType | "void";

/** 字段来源：field = 派生自物理表 fields（落库）；extra = 表单配置新增的纯展示元素（不落库）。 */
export type FieldSource = "field" | "extra";

/** 物理表存储配置（仅 source==="field" 的顶层字段拥有；只由「数据库构建」编辑）。 */
export interface StorageConfig {
  /** 字段标题（fields[].title）。 */
  title?: string;
  type: DatabaseColumnType;
  valueType?: DatabaseValueType;
  column?: string;
  system?: boolean;
  nullable?: boolean;
  default?: string | number | boolean;
  unique?: boolean;
  index?: boolean;
  visible?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  relation?: DatabaseRelation;
}

/** 表单表现配置（form-schema 片段；只由「表单配置」编辑）。 */
export interface FormConfig {
  /** 表单标签（form-schema.properties[key].title）。 */
  title?: string;
  component?: string;
  /** 仅对表单新增的展示/嵌套字段有效；落库字段的 required 由 storage.nullable 派生。 */
  required?: boolean;
  display?: string;
  description?: string;
  default?: unknown;
  props?: Record<string, unknown>;
  dataSource?: FieldSchema["dataSource"];
}

/** 构建器统一字段树节点。 */
export interface FieldNode {
  /** 稳定 id，命令寻址用（非业务 key）。 */
  id: string;
  key: string;
  type: FieldType;
  source: FieldSource;
  storage?: StorageConfig;
  form: FormConfig;
  /** object / array 容器的子字段（纯展示，随 json 列存储）。 */
  children?: FieldNode[];
}

export interface GroupDraft extends FieldGroup {
  id: string;
}

export interface ModelDraft {
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  group: string;
  singularLabel?: string;
  pluralLabel?: string;
  defaultPageSize: number;
  openMode: Record<"add" | "edit" | "detail", OpenMode>;
  /** 统一字段树：顶层含落库字段与新增展示元素，嵌套 children 为 object/array 子字段。 */
  fields: FieldNode[];
  groups: GroupDraft[];
}

export type { BuilderSchema };
