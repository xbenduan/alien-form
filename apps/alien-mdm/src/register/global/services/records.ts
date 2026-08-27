import { apiGet, apiSend } from "@runtime/transport";
import type { ModelRecord, RecordListParams, RecordListResult } from "@runtime/types";
import type { ServiceSend } from "./index";

/** 记录 CRUD 与选项/子树查询的 API 客户端。 */
export const recordsServices: Record<string, ServiceSend> = {
  "records.list": (params) =>
    apiSend<RecordListResult>("POST", "/records/list", params as RecordListParams),
  "records.options": (params) =>
    apiSend<{ options: Array<{ value: string | number; label: string }>; total: number }>(
      "POST",
      "/records/options",
      params,
    ),
  "records.subtree": (params) =>
    apiSend<{ list: ModelRecord[] }>("POST", "/records/subtree", params as RecordListParams),
  "records.get": (params) => {
    const { model, id } = params as { model: string; id: string };
    return apiGet<ModelRecord>(`/records/${encodeURIComponent(model)}/${encodeURIComponent(id)}`);
  },
  "records.create": (params) => {
    const { model, values } = params as { model: string; values: Record<string, unknown> };
    return apiSend<ModelRecord>("POST", `/records/${encodeURIComponent(model)}`, values);
  },
  "records.update": (params) => {
    const { model, id, values } = params as {
      model: string;
      id: string;
      values: Record<string, unknown>;
    };
    return apiSend<ModelRecord>(
      "PUT",
      `/records/${encodeURIComponent(model)}/${encodeURIComponent(id)}`,
      values,
    );
  },
  "records.delete": (params) => {
    const { model, id } = params as { model: string; id: string };
    return apiSend<void>(
      "DELETE",
      `/records/${encodeURIComponent(model)}/${encodeURIComponent(id)}`,
    );
  },
  "records.deleteMany": (params) => {
    const { model, ids } = params as { model: string; ids: string[] };
    return apiSend<void>("POST", `/records/${encodeURIComponent(model)}/batch-delete`, { ids });
  },
};
