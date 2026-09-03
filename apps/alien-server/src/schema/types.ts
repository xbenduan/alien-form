/**
 * 后端本地的配置态 schema 类型。
 *
 * database 是存储事实，definitions.form-schema 是表现配置。
 * 后端建表、CRUD 和关系查询只解释 database，不从 UI schema 反推存储语义。
 */

/** 列的物理存储类型（映射到 SQLite）。 */
export type ColumnType = "text" | "integer" | "real" | "boolean" | "json";

export type RelationKind = "many-to-one" | "many-to-many";

export type DatabaseValueType = "string" | "number" | "boolean" | "object" | "array";

export interface DatabaseRelation {
  kind: RelationKind;
  target: string;
  through?: string;
  valueField?: string;
  labelField?: string;
}

export interface DatabaseField {
  title?: string;
  column?: string;
  type: ColumnType;
  valueType?: DatabaseValueType;
  nullable?: boolean;
  default?: string | number | boolean;
  unique?: boolean;
  index?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  relation?: DatabaseRelation;
}

export interface DatabaseSchema {
  fields: Record<string, DatabaseField>;
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

export interface FieldGroup {
  component?: string;
  keys: string[];
  title?: string;
  description?: string;
  props?: Record<string, unknown>;
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
  group?: FieldGroup[];
  "x-table"?: {
    width?: number;
    visible?: boolean;
    ellipsis?: boolean;
    sortable?: boolean;
    filterable?: boolean;
  };
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
  database: DatabaseSchema;
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

export function databaseFields(schema: ModelSchema): Record<string, DatabaseField> {
  const fields = schema.database?.fields;
  if (!fields || Object.keys(fields).length === 0) {
    throw new Error("database.fields 不能为空");
  }
  return fields;
}

function valueType(field: DatabaseField): DatabaseValueType {
  if (field.valueType) return field.valueType;
  if (field.type === "integer" || field.type === "real") return "number";
  if (field.type === "boolean") return "boolean";
  if (field.type === "json") return "object";
  return "string";
}

export function assertModelSchema(value: unknown): asserts value is ModelSchema {
  if (!value || typeof value !== "object") throw new Error("模型定义必须是对象");
  const schema = value as Partial<ModelSchema>;
  if (!schema.meta?.name || !schema.meta.title) throw new Error("模型 meta.name/meta.title 必填");
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(schema.meta.name)) {
    throw new Error("模型 meta.name 不合法");
  }
  if (!Array.isArray(schema["x-pages"])) throw new Error("模型 x-pages 必须是数组");
  const properties = formProperties(schema as ModelSchema);
  const fields = databaseFields(schema as ModelSchema);
  const columnTypes = new Set<ColumnType>(["text", "integer", "real", "boolean", "json"]);
  const valueTypes = new Set<DatabaseValueType>(["string", "number", "boolean", "object", "array"]);
  for (const [key, field] of Object.entries(fields)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`database.fields 字段名不合法：${key}`);
    }
    if (!field || !columnTypes.has(field.type)) {
      throw new Error(`database.fields.${key}.type 不合法`);
    }
    if (field.valueType && !valueTypes.has(field.valueType)) {
      throw new Error(`database.fields.${key}.valueType 不合法`);
    }
    if (field.column && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.column)) {
      throw new Error(`database.fields.${key}.column 不合法`);
    }
    if (
      field.relation &&
      (!["many-to-one", "many-to-many"].includes(field.relation.kind) ||
        !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(field.relation.target) ||
        (field.relation.through && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.relation.through)))
    ) {
      throw new Error(`database.fields.${key}.relation 不合法`);
    }
  }
  const propertyKeys = Object.keys(properties);
  const fieldKeys = Object.keys(fields);
  const missing = fieldKeys.filter((key) => !properties[key]);
  const extra = propertyKeys.filter((key) => !fields[key]);
  if (missing.length > 0) throw new Error(`form-schema 缺少数据库字段：${missing.join(", ")}`);
  if (extra.length > 0) throw new Error(`form-schema 包含非数据库字段：${extra.join(", ")}`);
  for (const [key, field] of Object.entries(fields)) {
    if (properties[key]?.type !== valueType(field)) {
      throw new Error(`form-schema 字段 ${key} 的 type 与 database.fields 不一致`);
    }
    if (Boolean(properties[key]?.required) !== (field.nullable === false)) {
      throw new Error(`form-schema 字段 ${key} 的 required 与 database.fields 不一致`);
    }
  }
  const formSchema = schema.definitions?.["form-schema"];
  const groups = formSchema?.group ?? [];
  const assigned = new Set<string>();
  for (const [index, group] of groups.entries()) {
    if (!Array.isArray(group.keys)) throw new Error(`form-schema.group[${index}].keys 必须是数组`);
    for (const key of group.keys) {
      if (!properties[key]) throw new Error(`form-schema.group 引用了不存在的字段：${key}`);
      if (assigned.has(key)) throw new Error(`form-schema.group 字段重复：${key}`);
      assigned.add(key);
    }
  }
  const visit = (current: unknown, path: string): void => {
    if (typeof current === "string" && current.includes("{{")) {
      throw new Error(`${path} 不允许包含表达式`);
    }
    if (!current || typeof current !== "object") return;
    for (const [key, child] of Object.entries(current)) {
      if (key === "x-database") {
        throw new Error(`${path} 不允许包含 x-database`);
      }
      visit(child, `${path}.${key}`);
    }
  };
  visit(formSchema, "definitions.form-schema");
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
