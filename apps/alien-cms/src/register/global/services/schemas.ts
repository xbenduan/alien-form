import type { ServiceDescribe } from "../../../runtime";
import { apiGet, apiSend } from "../../../runtime/transport";
import type { ModelSchema, ModelSummary } from "../../../runtime/types";

export const schemaServices: ServiceDescribe[] = [
  {
    code: "schema.list",
    send: () => apiGet<ModelSummary[]>("/schemas"),
  },
  {
    code: "schema.get",
    send: (params) => {
      const { name } = params as { name: string };
      return apiGet<ModelSchema>(`/schemas/${encodeURIComponent(name)}`);
    },
  },
  {
    code: "schema.create",
    send: (params) => apiSend<ModelSchema>("POST", "/schemas", params),
  },
  {
    code: "schema.update",
    send: (params) => {
      const { name, schema } = params as { name: string; schema: ModelSchema };
      return apiSend<ModelSchema>("PUT", `/schemas/${encodeURIComponent(name)}`, schema);
    },
  },
  {
    code: "schema.delete",
    send: (params) => {
      const { name } = params as { name: string };
      return apiSend<void>("DELETE", `/schemas/${encodeURIComponent(name)}`);
    },
  },
];
