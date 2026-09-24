import { z } from "zod";
import type { ModelRecord } from "./runtime-types.ts";

const modelName = z.string().regex(/^[A-Za-z_][A-Za-z0-9_-]*$/, "模型名不合法");

export interface ModelSummary {
  name: string;
  title: string;
  version: number;
  system?: boolean;
  creatorId?: string;
  subtitle?: string;
  description?: string;
  group?: string;
  singularLabel?: string;
  pluralLabel?: string;
  defaultPageSize?: number;
  fieldCount: number;
  updatedAt?: string;
}

export const modelSummarySchema: z.ZodType<ModelSummary> = z.object({
  name: modelName,
  title: z.string(),
  version: z.number().int().positive(),
  system: z.boolean().optional(),
  creatorId: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  group: z.string().optional(),
  singularLabel: z.string().optional(),
  pluralLabel: z.string().optional(),
  defaultPageSize: z.number().int().positive().optional(),
  fieldCount: z.number().int().nonnegative(),
  updatedAt: z.string().optional(),
});

export function parseModelSummaries(value: unknown): ModelSummary[] {
  return z.array(modelSummarySchema).parse(value);
}

export const paginationSchema = z.object({
  current: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(200),
});

export const sorterSchema = z.object({
  field: z.string(),
  order: z.enum(["ascend", "descend"]),
});

export const listRequestSchema = z.object({
  model: modelName,
  filter: z.string().optional(),
  pagination: paginationSchema.optional(),
  sorter: sorterSchema.optional(),
  keyword: z.string().optional(),
  searchFields: z.array(z.string()).optional(),
  parentId: z.string().nullable().optional(),
});
export type ListRequest = z.infer<typeof listRequestSchema>;

export interface ListResponse<T = ModelRecord> {
  list: T[];
  total: number;
}

export const optionsRequestSchema = z.object({
  model: modelName,
  valueKey: z.string().optional(),
  labelKey: z.string().optional(),
  keyword: z.string().optional(),
  selectedValues: z.array(z.union([z.string(), z.number()])).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export type OptionsRequest = z.infer<typeof optionsRequestSchema>;

export interface OptionsResponse {
  options: Array<{ value: string | number; label: string }>;
  total: number;
}

export const subtreeRequestSchema = z.object({
  model: modelName,
  idField: z.string().optional(),
  parentField: z.string().optional(),
  parentValue: z.string().nullable().optional(),
});
export type SubtreeRequest = z.infer<typeof subtreeRequestSchema>;

export interface SubtreeResponse<T = ModelRecord> {
  list: T[];
}

export const recordValuesSchema = z.record(z.unknown());
export type RecordValues = z.infer<typeof recordValuesSchema>;

export const batchDeleteRequestSchema = z.object({
  ids: z.array(z.string()).max(1000),
});
export type BatchDeleteRequest = z.infer<typeof batchDeleteRequestSchema>;

export const loginRequestSchema = z.object({
  provider: z.string().optional(),
  username: z.string().optional(),
  account: z.string().optional(),
  password: z.string().optional(),
  openid: z.string().optional(),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export interface LoginResponse {
  token: string;
  user: ModelRecord;
  provider: string;
}
