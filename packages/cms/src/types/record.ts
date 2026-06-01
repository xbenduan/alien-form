import type { FilterItem, MutationResult, PaginatedResult, Pagination, Sorter } from "./common";

// ─── Model Record ────────────────────────────────────────────
export interface ModelRecord {
  id: string;
  [key: string]: unknown;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Record CRUD Params ──────────────────────────────────────
export interface RecordListParams {
  model: string;
  filters?: Record<string, unknown>;
  typedFilters?: FilterItem[];
  pagination?: Pagination;
  sorter?: Sorter;
}

export interface RecordDetailParams {
  model: string;
  id: string;
}

export interface RecordCreateParams {
  model: string;
  values: Record<string, unknown>;
}

export interface RecordUpdateParams {
  model: string;
  id: string;
  values: Record<string, unknown>;
}

export interface RecordDeleteParams {
  model: string;
  id: string;
}

export interface RecordBatchDeleteParams {
  model: string;
  ids: string[];
}

// ─── Record CRUD Results ─────────────────────────────────────
export type RecordListResult = PaginatedResult<ModelRecord>;
export type RecordDetailResult = ModelRecord;
export type RecordCreateResult = MutationResult<ModelRecord>;
export type RecordUpdateResult = MutationResult<ModelRecord>;
export type RecordDeleteResult = MutationResult<void>;
export type RecordBatchDeleteResult = MutationResult<{ deleted: number }>;
