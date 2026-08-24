import type { ServiceDescribe } from "../../../runtime";
import { apiGet, apiSend } from "../../../runtime/transport";
import type { ModelRecord, RecordListParams, RecordListResult } from "../../../runtime/types";

export const recordsServices: ServiceDescribe[] = [
  {
    code: "records.list",
    send: (params) => apiSend<RecordListResult>("POST", "/records/list", params as RecordListParams),
  },
  {
    code: "records.get",
    send: (params) => {
      const { model, id } = params as { model: string; id: string };
      return apiGet<ModelRecord>(`/records/${encodeURIComponent(model)}/${encodeURIComponent(id)}`);
    },
  },
  {
    code: "records.create",
    send: (params) => {
      const { model, values } = params as { model: string; values: Record<string, unknown> };
      return apiSend<ModelRecord>("POST", `/records/${encodeURIComponent(model)}`, values);
    },
  },
  {
    code: "records.update",
    send: (params) => {
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
  },
  {
    code: "records.delete",
    send: (params) => {
      const { model, id } = params as { model: string; id: string };
      return apiSend<void>(
        "DELETE",
        `/records/${encodeURIComponent(model)}/${encodeURIComponent(id)}`,
      );
    },
  },
  {
    code: "records.deleteMany",
    send: (params) => {
      const { model, ids } = params as { model: string; ids: string[] };
      return apiSend<void>("POST", `/records/${encodeURIComponent(model)}/batch-delete`, { ids });
    },
  },
];
