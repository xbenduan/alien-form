import type { BuilderSchema, ModelMeta } from "@alien-form/engine";

export interface ModelSummary extends ModelMeta {
  fieldCount: number;
  updatedAt: string;
}

export interface ListRequest {
  model: string;
  /** PocketBase 风格的字段筛选表达式。 */
  filter?: string;
  pagination?: { current: number; pageSize: number };
  sorter?: { field: string; order: "ascend" | "descend" };
  keyword?: string;
  searchFields?: string[];
  parentId?: string | null;
}

export interface ListResponse<T = Record<string, unknown>> {
  list: T[];
  total: number;
}

export interface SubtreeRequest {
  model: string;
  idField: string;
  parentField: string;
  parentValue?: string | null;
}

export interface SubtreeResponse<T = Record<string, unknown>> {
  list: T[];
}

export interface LoginResponse {
  token: string;
  user: Record<string, unknown>;
  provider: string;
}

export type { BuilderSchema };
