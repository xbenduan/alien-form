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
  runtime.service("auth.login", (body: { username: string; password: string }) =>
    transport.send<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
  runtime.service("auth.logout", () =>
    transport.send<void>("/api/auth/logout", { method: "POST" }),
  );
  runtime.service("schema.list", () => transport.send<ModelSummary[]>("/api/schemas"));
  runtime.service("schema.get", (modelCode: string) =>
    transport.send<BuilderSchema>(`/api/schemas/${modelCode}`),
  );
  runtime.service("schema.create", (schema: BuilderSchema) =>
    transport.send<BuilderSchema>("/api/schemas", {
      method: "POST",
      body: JSON.stringify(schema),
    }),
  );
  runtime.service("schema.update", (modelCode: string, schema: BuilderSchema) =>
    transport.send<BuilderSchema>(`/api/schemas/${modelCode}`, {
      method: "PUT",
      body: JSON.stringify(schema),
    }),
  );
  runtime.service("schema.delete", (modelCode: string) =>
    transport.send<void>(`/api/schemas/${modelCode}`, { method: "DELETE" }),
  );
  runtime.service("records.list", (request: ListRequest) =>
    transport.send<ListResponse>("/api/records/list", {
      method: "POST",
      body: JSON.stringify(request),
    }),
  );
  runtime.service("records.get", ({ model, id }: { model: string; id: string }) =>
    transport.send<Record<string, unknown>>(
      `/api/records/${encodeURIComponent(model)}/${encodeURIComponent(id)}`,
    ),
  );
  runtime.service("records.create", (modelCode: string, values: Record<string, unknown>) =>
    transport.send<Record<string, unknown>>(`/api/records/${modelCode}`, {
      method: "POST",
      body: JSON.stringify(values),
    }),
  );
  runtime.service(
    "records.update",
    (modelCode: string, id: string, values: Record<string, unknown>) =>
      transport.send<Record<string, unknown>>(`/api/records/${modelCode}/${id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      }),
  );
  runtime.service("records.delete", ({ model, id }: { model: string; id: unknown }) =>
    transport.send<void>(
      `/api/records/${encodeURIComponent(model)}/${encodeURIComponent(String(id))}`,
      { method: "DELETE" },
    ),
  );
  runtime.service("records.batchDelete", ({ model, ids }: { model: string; ids: string[] }) =>
    transport.send<void>(`/api/records/${encodeURIComponent(model)}/batch-delete`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  );
  runtime.service("record.add", (values: Record<string, unknown>, context: { modelCode: string }) =>
    transport.send<Record<string, unknown>>(
      `/api/records/${encodeURIComponent(context.modelCode)}`,
      {
        method: "POST",
        body: JSON.stringify(values),
      },
    ),
  );
  runtime.service(
    "record.edit",
    (values: Record<string, unknown>, context: { modelCode: string; recordId?: string }) =>
      transport.send<Record<string, unknown>>(
        `/api/records/${encodeURIComponent(context.modelCode)}/${encodeURIComponent(context.recordId ?? "")}`,
        {
          method: "PUT",
          body: JSON.stringify(values),
        },
      ),
  );
}
