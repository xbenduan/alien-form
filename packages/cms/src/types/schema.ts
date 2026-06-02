import type { IFieldSchema, IFormSchema } from "@alien-form/core";
import type { FilterOperator, MutationResult, PaginatedResult, Pagination } from "./common";

// ─── Value Formatting ────────────────────────────────────────
export type ValueFormat = "boolean" | "date" | "dateTime" | "status" | "image" | "link";

// ─── Model Action ────────────────────────────────────────────
export type ModelActionKind = "add" | "edit" | "detail";
export type ModelActionOpenMode = "modal" | "drawer" | "page";

// ─── Field UI Metadata (x-cms) ──────────────────────────────
export interface CmsFieldFilterMeta {
  visible?: boolean;
  defaultVisible?: boolean;
  operator?: FilterOperator;
}

export interface CmsFieldTableMeta {
  visible?: boolean;
  width?: number;
  ellipsis?: boolean;
  format?: ValueFormat;
  inline?: string[];
  expandable?: boolean;
  sortable?: boolean;
}

export interface CmsFieldFormMeta {
  modes?: Array<"add" | "edit">;
}

export interface CmsFieldDetailMeta {
  visible?: boolean;
  format?: ValueFormat;
}

export interface CmsFieldMobileMeta {
  cardTitle?: boolean;
  cardSubtitle?: boolean;
  cardTag?: boolean;
  listVisible?: boolean;
  priority?: number;
  component?: string;
}

export interface CmsFieldUiMeta {
  filter?: CmsFieldFilterMeta;
  table?: CmsFieldTableMeta;
  form?: CmsFieldFormMeta;
  detail?: CmsFieldDetailMeta;
  mobile?: CmsFieldMobileMeta;
  reactions?: Record<string, Record<string, unknown>>;
}

export interface CmsFieldSchema extends IFieldSchema {
  "x-cms"?: CmsFieldUiMeta;
}

// ─── Model Metadata (x-model) ───────────────────────────────
export interface CmsModelMeta {
  name: string;
  title?: string;
  subtitle?: string;
  description?: string;
  singularLabel?: string;
  pluralLabel?: string;
  primaryField?: string;
  defaultFilterCount?: number;
  defaultPageSize?: number;
  openMode?: Partial<Record<ModelActionKind, ModelActionOpenMode>>;
  actions?: {
    row?: string[];
    batch?: string[];
    toolbar?: string[];
  };
}

export interface CmsModelSchema extends Omit<IFormSchema, "properties"> {
  properties?: Record<string, CmsFieldSchema>;
  "x-model"?: CmsModelMeta;
}

// ─── Model Summary (for listing) ────────────────────────────
export interface ModelSummary {
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  source: "static" | "runtime" | "remote";
  fieldCount?: number;
  updatedAt?: string;
}

// ─── Schema CRUD Params ──────────────────────────────────────
export interface SchemaListParams {
  pagination?: Pagination;
  keyword?: string;
}

export interface SchemaDetailParams {
  modelName: string;
}

export interface SchemaCreateParams {
  schema: CmsModelSchema;
}

export interface SchemaUpdateParams {
  modelName: string;
  schema: CmsModelSchema;
}

export interface SchemaDeleteParams {
  modelName: string;
}

// ─── Schema CRUD Results ─────────────────────────────────────
export type SchemaListResult = PaginatedResult<ModelSummary>;
export type SchemaDetailResult = CmsModelSchema;
export type SchemaCreateResult = MutationResult<ModelSummary>;
export type SchemaUpdateResult = MutationResult<ModelSummary>;
export type SchemaDeleteResult = MutationResult<void>;
