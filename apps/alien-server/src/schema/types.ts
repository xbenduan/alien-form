/**
 * 后端本地的配置态 schema 类型。
 *
 * 与前端 @alien-form/shared 的 ModelSchema 同构，但后端只关心「建表 + CRUD」
 * 需要的那部分：字段的存储语义（x-database）、多语言/布局等展示细节后端不解释，
 * 用宽松的索引签名透传即可（存进 _schemas 元表原样返回给前端）。
 */

/** 列的物理存储类型（映射到 SQLite）。 */
export type ColumnType = "text" | "integer" | "real" | "boolean" | "json";

/** 关系类型：多对一（外键标量）/ 多对多（junction 表）。 */
export type RelationKind = "many-to-one" | "many-to-many";

/**
 * x-database：字段的「后端事实」声明。
 * 决定建表列类型、约束、索引，以及 filter 是否可见 / 列是否可排序。
 */
export interface XDatabase {
  /** 列类型；缺省由字段 type/component 推导。 */
  type?: ColumnType;
  nullable?: boolean;
  /** 物理默认值（写入 DEFAULT）。 */
  default?: string | number | boolean;
  unique?: boolean;
  /** 建索引；同时作为「可高效筛选」的信号。 */
  index?: boolean;
  /** 是否进入 filter 筛选区（缺省跟随 index）。 */
  filterable?: boolean;
  /** 表格列是否可排序（缺省 true，复杂/JSON 列为 false）。 */
  sortable?: boolean;
  /** 关系声明。 */
  relation?: RelationKind;
  /** 关系目标模型（modelCode）。 */
  target?: string;
  /** many-to-many 的 junction 表名（缺省由两端模型名派生）。 */
  through?: string;
}

/** 静态选项项。 */
export interface DataSourceItem {
  label: string;
  value: unknown;
}

/** 通用插件 marker（后端只透传，不解释）。 */
export interface PluginMarker {
  plugin: string;
  [key: string]: unknown;
}

/** 模型字段：后端只强类型化关心的字段，其余透传。 */
export interface ModelFieldSchema {
  type?: string;
  title?: string;
  component?: string;
  required?: boolean;
  order?: number;
  display?: string;
  default?: unknown;
  dataSource?: DataSourceItem[] | PluginMarker;
  properties?: Record<string, ModelFieldSchema>;
  items?: ModelFieldSchema | ModelFieldSchema[];
  "x-database"?: XDatabase;
  "x-table"?: { width?: number; visible?: boolean; ellipsis?: boolean; sortable?: boolean };
  [key: string]: unknown;
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
  filterCount?: number;
  openMode?: string | Record<"add" | "edit" | "detail", string>;
  [key: string]: unknown;
}

export interface XPage {
  router: string;
  title?: string;
  layout?: { component: string; props?: Record<string, unknown> };
  schema: { properties: Record<string, ModelFieldSchema> };
}

export interface ModelSchema {
  meta: ModelMeta;
  "x-pages": XPage[];
  definitions: {
    "form-schema": ModelFieldSchema;
    [key: string]: ModelFieldSchema;
  };
  [key: string]: unknown;
}

export function formProperties(schema: ModelSchema): Record<string, ModelFieldSchema> {
  const properties = schema.definitions?.["form-schema"]?.properties;
  if (!properties || Object.keys(properties).length === 0) {
    throw new Error("definitions['form-schema'].properties 不能为空");
  }
  return properties;
}

export function assertModelSchema(value: unknown): asserts value is ModelSchema {
  if (!value || typeof value !== "object") throw new Error("模型定义必须是对象");
  const schema = value as Partial<ModelSchema>;
  if (!schema.meta?.name || !schema.meta.title) throw new Error("模型 meta.name/meta.title 必填");
  if (!Array.isArray(schema["x-pages"])) throw new Error("模型 x-pages 必须是数组");
  const properties = formProperties(schema as ModelSchema);
  const visit = (current: unknown, path: string): void => {
    if (typeof current === "string" && current.includes("{{")) {
      throw new Error(`${path} 不允许包含表达式`);
    }
    if (!current || typeof current !== "object") return;
    for (const [key, child] of Object.entries(current)) visit(child, `${path}.${key}`);
  };
  visit(properties, "definitions.form-schema.properties");
}

/** 记录：任意键值 + 系统字段。 */
export interface ModelRecord {
  id: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface Pagination {
  current: number;
  pageSize: number;
}

export interface Sorter {
  field: string;
  order: "ascend" | "descend";
}

export function isPluginMarker(value: unknown): value is PluginMarker {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { plugin?: unknown }).plugin === "string"
  );
}
