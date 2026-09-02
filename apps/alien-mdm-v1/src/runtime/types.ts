import type { BuilderSchema, ModelMeta } from "@engine";

export interface ModelSummary extends ModelMeta {
  fieldCount: number;
  updatedAt: string;
}

export interface ListRequest {
  model: string;
  filters?: Record<string, unknown>;
  pagination?: { current: number; pageSize: number };
  sorter?: { field: string; order: "ascend" | "descend" };
}

export interface ListResponse<T = Record<string, unknown>> {
  list: T[];
  total: number;
}

export interface LoginResponse {
  token: string;
  user: Record<string, unknown>;
  provider: string;
}

export type { BuilderSchema };
