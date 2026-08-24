import type {
  ModelFieldSchema,
  ModelGroup,
  ModelMeta,
  ModelSchema,
  OpenMode,
  TableFieldMeta,
} from "@alien-form/shared";

// 模型 schema 相关类型统一由 SchemaCompiler（@alien-form/shared）提供，
// services 层直接透传，避免同一套类型在两处分叉。
export type {
  ModelFieldSchema,
  ModelGroup,
  ModelMeta,
  ModelSchema,
  OpenMode,
  TableFieldMeta,
};

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
