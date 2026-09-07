import type { Runtime } from "@alien-form/engine";
import type { BuilderSchema, ModelSummary } from "@app-types";
import { transport } from "@runtime/transport";

export function registerModelServices(runtime: Runtime): void {
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
}
