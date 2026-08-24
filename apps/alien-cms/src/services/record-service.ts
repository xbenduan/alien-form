import { apiGet, apiSend } from "./api-client";
import type { ModelRecord, RecordListParams, RecordListResult } from "./types";

/** 记录列表：filters / pagination / sorter 交后端处理（filter 仅作用于 filterable 字段）。 */
export function listRecords(params: RecordListParams): Promise<RecordListResult> {
  return apiSend<RecordListResult>("POST", "/records/list", {
    model: params.model,
    filters: params.filters,
    pagination: params.pagination,
    sorter: params.sorter,
  });
}

export function getRecord(model: string, id: string): Promise<ModelRecord> {
  return apiGet<ModelRecord>(`/records/${encodeURIComponent(model)}/${encodeURIComponent(id)}`);
}

export function createRecord(
  model: string,
  values: Record<string, unknown>,
): Promise<ModelRecord> {
  return apiSend<ModelRecord>("POST", `/records/${encodeURIComponent(model)}`, values);
}

export function updateRecord(
  model: string,
  id: string,
  values: Record<string, unknown>,
): Promise<ModelRecord> {
  return apiSend<ModelRecord>(
    "PUT",
    `/records/${encodeURIComponent(model)}/${encodeURIComponent(id)}`,
    values,
  );
}

export function deleteRecord(model: string, id: string): Promise<void> {
  return apiSend<void>(
    "DELETE",
    `/records/${encodeURIComponent(model)}/${encodeURIComponent(id)}`,
  );
}

export function deleteRecords(model: string, ids: string[]): Promise<void> {
  return apiSend<void>("POST", `/records/${encodeURIComponent(model)}/batch-delete`, { ids });
}
