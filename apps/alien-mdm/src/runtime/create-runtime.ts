import { Runtime } from "@alien-form/engine";
import type { ServiceDescriptor } from "@alien-form/engine";
import { MemoryRouterAdapter } from "@alien-form/engine";
import { apiGet, apiSend } from "./transport";
import { registerAll } from "../register";
import type {
  LoginPayload,
  LoginResult,
  ModelRecord,
  ModelSchema,
  ModelSummary,
  RecordListParams,
  RecordListResult,
} from "./types";

function createService(code: string, send: ServiceDescriptor["send"]): ServiceDescriptor {
  return { code, send };
}

const recordsServices: ServiceDescriptor[] = [
  createService("records.list", (params) =>
    apiSend<RecordListResult>("POST", "/records/list", params as RecordListParams),
  ),
  createService("records.subtree", (params) =>
    apiSend<{ list: ModelRecord[] }>("POST", "/records/subtree", params as RecordListParams),
  ),
  createService("records.get", (params) => {
    const { model, id } = params as { model: string; id: string };
    return apiGet<ModelRecord>(`/records/${encodeURIComponent(model)}/${encodeURIComponent(id)}`);
  }),
  createService("records.create", (params) => {
    const { model, values } = params as { model: string; values: Record<string, unknown> };
    return apiSend<ModelRecord>("POST", `/records/${encodeURIComponent(model)}`, values);
  }),
  createService("records.update", (params) => {
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
  }),
  createService("records.delete", (params) => {
    const { model, id } = params as { model: string; id: string };
    return apiSend<void>(
      "DELETE",
      `/records/${encodeURIComponent(model)}/${encodeURIComponent(id)}`,
    );
  }),
  createService("records.deleteMany", (params) => {
    const { model, ids } = params as { model: string; ids: string[] };
    return apiSend<void>("POST", `/records/${encodeURIComponent(model)}/batch-delete`, { ids });
  }),
];

const schemaServices: ServiceDescriptor[] = [
  createService("schema.list", () => apiGet<ModelSummary[]>("/schemas")),
  createService("schema.get", (params) => {
    const { name } = params as { name: string };
    return apiGet<ModelSchema>(`/schemas/${encodeURIComponent(name)}`);
  }),
  createService("schema.create", (params) => apiSend<ModelSchema>("POST", "/schemas", params)),
  createService("schema.update", (params) => {
    const { name, schema } = params as { name: string; schema: ModelSchema };
    return apiSend<ModelSchema>("PUT", `/schemas/${encodeURIComponent(name)}`, schema);
  }),
  createService("schema.delete", (params) => {
    const { name } = params as { name: string };
    return apiSend<void>("DELETE", `/schemas/${encodeURIComponent(name)}`);
  }),
];

const authServices: ServiceDescriptor[] = [
  createService("auth.login", (params) => {
    const payload = params as LoginPayload;
    return apiSend<LoginResult>("POST", "/auth/login", {
      provider: payload.provider ?? "password",
      username: payload.username,
      password: payload.password,
    });
  }),
  createService("auth.logout", (params) => apiSend<void>("POST", "/auth/logout", params)),
];

let appRuntime: Runtime | undefined;

export function createAppRuntime(): Runtime {
  if (appRuntime) return appRuntime;

  const runtime = new Runtime({
    router: new MemoryRouterAdapter({ path: "/" }),
  });

  for (const svc of [...recordsServices, ...schemaServices, ...authServices]) {
    runtime.service(svc);
  }

  runtime.constant("i18n", {});

  // 全局 + per-model 组件/常量注册（业务枚举常量在 register/global 内维护）。
  registerAll(runtime);

  appRuntime = runtime;
  return runtime;
}

export function getAppRuntime(): Runtime {
  if (!appRuntime) throw new Error("[alien-mdm] Runtime not initialized");
  return appRuntime;
}
