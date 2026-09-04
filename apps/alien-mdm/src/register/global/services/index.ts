import type { Runtime } from "@alien-form/engine";
import type {
  BuilderSchema,
  ListRequest,
  ListResponse,
  LoginResponse,
  ModelSummary,
} from "@app-types";
import { transport } from "@runtime/transport";

export function registerServices(runtime: Runtime): void {
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
    send: ({ model, id }: { model: string; id: string }) =>
      transport.send<Record<string, unknown>>(
        `/api/records/${encodeURIComponent(model)}/${encodeURIComponent(id)}`,
      ),
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
    send: ({ model, id }: { model: string; id: unknown }) =>
      transport.send<void>(
        `/api/records/${encodeURIComponent(model)}/${encodeURIComponent(String(id))}`,
        { method: "DELETE" },
      ),
  });
  runtime.service({
    code: "records.batchDelete",
    send: ({ model, ids }: { model: string; ids: string[] }) =>
      transport.send<void>(`/api/records/${encodeURIComponent(model)}/batch-delete`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
  });
  runtime.service({
    code: "record.add",
    send: (values: Record<string, unknown>, context: { modelCode: string }) =>
      transport.send<Record<string, unknown>>(
        `/api/records/${encodeURIComponent(context.modelCode)}`,
        {
          method: "POST",
          body: JSON.stringify(values),
        },
      ),
  });
  runtime.service({
    code: "record.edit",
    send: (values: Record<string, unknown>, context: { modelCode: string; recordId?: string }) =>
      transport.send<Record<string, unknown>>(
        `/api/records/${encodeURIComponent(context.modelCode)}/${encodeURIComponent(context.recordId ?? "")}`,
        {
          method: "PUT",
          body: JSON.stringify(values),
        },
      ),
  });
  runtime.service({
    code: "router.go",
    send: (path: string) => {
      window.history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
  });
}
