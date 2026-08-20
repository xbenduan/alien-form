import type { FieldSchema, GroupConfig, SchemaConfig } from "@alien-form/shared";

/** table 列的展示元信息（宽度、省略、排序、是否可见）。 */
export interface TableFieldMeta {
  width?: number;
  ellipsis?: boolean;
  sortable?: boolean;
  visible?: boolean;
}

/**
 * 模型字段：alien-form 协议字段 + CMS 层扩展元信息。
 * - x-table：table 列展示配置
 * - x-handler-params：handler（如 loadDataSource）运行参数
 */
export interface ModelFieldSchema extends FieldSchema {
  /** 字段 key：编辑态承载在字段 schema 上，便于在 JSON 中直接查看/修改；构建输出时剥离（key 即 properties 的键）。 */
  key?: string;
  "x-table"?: TableFieldMeta;
  "x-handler-params"?: Record<string, Record<string, unknown>>;
  properties?: Record<string, ModelFieldSchema>;
  items?: ModelFieldSchema | ModelFieldSchema[];
}

/** 详情/新增/编辑的打开方式。 */
export type OpenMode = "page" | "drawer" | "modal";

/** 模型分组：用于落地页按「系统 / 其他」归类展示。 */
export type ModelGroup = "system" | "other";

/** 模型元信息：驱动列表页标题、分页、打开方式等。 */
export interface ModelMeta {
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  group?: ModelGroup;
  singularLabel: string;
  pluralLabel: string;
  defaultPageSize: number;
  filterCount?: number;
  openMode: Record<"add" | "edit" | "detail", OpenMode>;
}

/**
 * 模型 schema：alien-form 协议的配置态 schema（properties + group）+ 模型元信息。
 * 一份 schema 同时投影出 form / table / filter 三个场景。
 */
export interface ModelSchema extends Omit<SchemaConfig, "properties"> {
  meta: ModelMeta;
  properties: Record<string, ModelFieldSchema>;
  group?: GroupConfig[];
}

/** 模型摘要（落地页卡片、列表用）。 */
export interface ModelSummary {
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  group?: ModelGroup;
  fieldCount: number;
  updatedAt: string;
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

export interface RecordListParams {
  model: string;
  filters?: Record<string, unknown>;
  pagination?: Pagination;
  sorter?: Sorter;
}

export interface RecordListResult {
  list: ModelRecord[];
  total: number;
}
