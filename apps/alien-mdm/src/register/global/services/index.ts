import type { Runtime } from "@alien-form/engine";
import type {
  BuilderSchema,
  ListRequest,
  ListResponse,
  LoginResponse,
  ModelSummary,
} from "@app-types";
import type { Transport } from "@runtime/transport";

export function registerServices(runtime: Runtime, transport: Transport): void {
  runtime.service({
    code: "auth.login",
    send: (body: { username: string; password: string }) =>
      transport.send<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
  runtime.service({
    code: "auth.logout",
    send: () => transport.send<void>("/api/auth/logout", { method: "POST" }),
  });
  runtime.service({
    code: "schema.list",
    send: () => transport.send<ModelSummary[]>("/api/schemas"),
  });
  runtime.service({
    code: "schema.get",
    send: (modelCode: string) => transport.send<BuilderSchema>(`/api/schemas/${modelCode}`),
  });
  runtime.service({
    code: "schema.create",
    send: (schema: BuilderSchema) =>
      transport.send<BuilderSchema>("/api/schemas", {
        method: "POST",
        body: JSON.stringify(schema),
      }),
  });
  runtime.service({
    code: "schema.update",
    send: (modelCode: string, schema: BuilderSchema) =>
      transport.send<BuilderSchema>(`/api/schemas/${modelCode}`, {
        method: "PUT",
        body: JSON.stringify(schema),
      }),
  });
  runtime.service({
    code: "schema.delete",
    send: (modelCode: string) =>
      transport.send<void>(`/api/schemas/${modelCode}`, { method: "DELETE" }),
  });
  runtime.service({
    code: "records.list",
    send: (request: ListRequest) =>
      transport.send<ListResponse>("/api/records/list", {
        method: "POST",
        body: JSON.stringify(request),
      }),
  });
  runtime.service({
    code: "records.get",
    send: (modelCode: string, id: string) =>
      transport.send<Record<string, unknown>>(`/api/records/${modelCode}/${id}`),
  });
  runtime.service({
    code: "records.create",
    send: (modelCode: string, values: Record<string, unknown>) =>
      transport.send<Record<string, unknown>>(`/api/records/${modelCode}`, {
        method: "POST",
        body: JSON.stringify(values),
      }),
  });
  runtime.service({
    code: "records.update",
    send: (modelCode: string, id: string, values: Record<string, unknown>) =>
      transport.send<Record<string, unknown>>(`/api/records/${modelCode}/${id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      }),
  });
  runtime.service({
    code: "records.delete",
    send: (modelCode: string, id: string) =>
      transport.send<void>(`/api/records/${modelCode}/${id}`, { method: "DELETE" }),
  });
  runtime.service({
    code: "router.go",
    send: (path: string) => {
      window.history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
  });
}
