import { apiGet, apiSend } from "./api-client";
import type { ModelSchema, ModelSummary } from "./types";

/** 列出所有模型摘要（落地页 / 列表用）。 */
export function listSchemas(): Promise<ModelSummary[]> {
  return apiGet<ModelSummary[]>("/schemas");
}

export function getSchema(name: string): Promise<ModelSchema> {
  return apiGet<ModelSchema>(`/schemas/${encodeURIComponent(name)}`);
}

export function createSchema(schema: ModelSchema): Promise<ModelSchema> {
  return apiSend<ModelSchema>("POST", "/schemas", schema);
}

export function updateSchema(name: string, schema: ModelSchema): Promise<ModelSchema> {
  return apiSend<ModelSchema>("PUT", `/schemas/${encodeURIComponent(name)}`, schema);
}

export function deleteSchema(name: string): Promise<void> {
  return apiSend<void>("DELETE", `/schemas/${encodeURIComponent(name)}`);
}
