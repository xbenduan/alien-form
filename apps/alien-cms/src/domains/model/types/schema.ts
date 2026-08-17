import type { IFieldSchema, IFormSchema } from "@alien-form/core";
import type { MutationResult, PaginatedResult, Pagination } from "./common";

export type CmsFieldType = "string" | "number" | "boolean" | "object" | "array" | "tags";
export type ValueFormat = "boolean" | "date" | "dateTime" | "status" | "image" | "link";
export type ModelActionKind = "add" | "edit" | "detail";
export type ModelActionOpenMode = "modal" | "drawer" | "page";

export interface CmsFieldTableMeta {
  width?: number;
  ellipsis?: boolean;
  format?: ValueFormat;
  inline?: string[];
  expandable?: boolean;
  sortable?: boolean;
  visible?: boolean;
  order?: number;
}

export interface CmsFieldFilterMeta {
  visible?: boolean;
  operator?: string;
  defaultVisible?: boolean;
  props?: Record<string, unknown>;
}

export interface CmsFieldFormMeta {
  modes?: Array<"add" | "edit">;
}

export interface CmsFieldDetailMeta {
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
  table?: CmsFieldTableMeta;
  filter?: CmsFieldFilterMeta;
  form?: CmsFieldFormMeta;
  detail?: CmsFieldDetailMeta;
  mobile?: CmsFieldMobileMeta;
  reactions?: Record<string, Record<string, unknown>>;
}

export interface CmsFieldSchema extends Omit<IFieldSchema, "type" | "properties" | "items"> {
  type?: CmsFieldType;
  properties?: Record<string, CmsFieldSchema>;
  items?: CmsFieldSchema | CmsFieldSchema[];
  "x-cms"?: CmsFieldUiMeta;
  "x-handler-params"?: Record<string, Record<string, unknown>>;
}

export interface CmsModelFilterMeta {
  count?: number;
}

export interface CmsModelTableMeta {
  width?: number;
  visible?: string[];
}

export interface CmsModelMeta {
  name: string;
  title?: string;
  subtitle?: string;
  description?: string;
  singularLabel?: string;
  pluralLabel?: string;
  primaryField?: string;
  filter?: CmsModelFilterMeta;
  table?: CmsModelTableMeta;
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

export interface ModelSummary {
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  source: "static" | "runtime" | "remote";
  fieldCount?: number;
  updatedAt?: string;
}

export interface SchemaListFilters {
  name?: string;
  title?: string;
  description?: string;
  source?: string;
}

export interface SchemaListParams {
  pagination?: Pagination;
  filters?: SchemaListFilters;
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

export type SchemaListResult = PaginatedResult<ModelSummary>;
export type SchemaDetailResult = CmsModelSchema;
export type SchemaCreateResult = MutationResult<ModelSummary>;
export type SchemaUpdateResult = MutationResult<ModelSummary>;
export type SchemaDeleteResult = MutationResult<void>;
