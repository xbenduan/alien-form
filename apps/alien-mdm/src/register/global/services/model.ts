import type { Runtime } from "@alien-form/engine";
import { parseModelSchema, parseModelSummaries, type ModelSchema } from "@alien-form/protocol";
import { transport } from "@runtime/transport";

export function registerModelServices(runtime: Runtime): void {
  runtime.service("model.list", async () =>
    parseModelSummaries(await transport.send<unknown>("/api/v1/models")),
  );
  runtime.service("model.get", async (modelCode: string) =>
    parseModelSchema(await transport.send<unknown>(`/api/v1/models/${modelCode}`)),
  );
  runtime.service("model.create", async (schema: ModelSchema) =>
    parseModelSchema(
      await transport.send<unknown>("/api/v1/models", {
        method: "POST",
        body: JSON.stringify(schema),
      }),
    ),
  );
  runtime.service("model.update", async (modelCode: string, schema: ModelSchema) =>
    parseModelSchema(
      await transport.send<unknown>(`/api/v1/models/${modelCode}`, {
        method: "PUT",
        body: JSON.stringify(schema),
      }),
    ),
  );
}
