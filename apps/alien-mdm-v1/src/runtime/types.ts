import type { BuilderSchema } from "@engine";

export interface ModelSummary {
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  group?: string;
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
