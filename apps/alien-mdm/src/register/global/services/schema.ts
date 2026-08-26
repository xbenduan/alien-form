import { apiGet, apiSend } from "../../../runtime/transport";
import type { ModelSchema, ModelSummary } from "../../../runtime/types";
import type { ServiceSend } from "./index";

/** 模型 schema 的读取与管理 API 客户端。 */
export const schemaServices: Record<string, ServiceSend> = {
  "schema.list": () => apiGet<ModelSummary[]>("/schemas"),
  "schema.get": (params) => {
    const { name } = params as { name: string };
    return apiGet<ModelSchema>(`/schemas/${encodeURIComponent(name)}`);
  },
  "schema.create": (params) => apiSend<ModelSchema>("POST", "/schemas", params),
  "schema.update": (params) => {
    const { name, schema } = params as { name: string; schema: ModelSchema };
    return apiSend<ModelSchema>("PUT", `/schemas/${encodeURIComponent(name)}`, schema);
  },
  "schema.delete": (params) => {
    const { name } = params as { name: string };
    return apiSend<void>("DELETE", `/schemas/${encodeURIComponent(name)}`);
  },
};
