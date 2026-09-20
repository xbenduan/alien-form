import type { Runtime } from "@alien-form/engine";
import { parseModelSchema, parseModelSummaries, type ModelSchema } from "@alien-form/protocol";
import { transport } from "@runtime/transport";

export function registerModelServices(runtime: Runtime): void {
  const list = async () => parseModelSummaries(await transport.send<unknown>("/api/v1/models"));
  const get = async (modelCode: string) =>
    parseModelSchema(await transport.send<unknown>(`/api/v1/models/${modelCode}`));

  runtime.service("model.list", list);
  runtime.service("model.get", get);
  runtime.service("model.options", async () =>
    (await list()).map((model) => ({ label: model.title, value: model.name })),
  );
  runtime.service("model.fieldOptions", async (modelCode: string | undefined) => {
    if (!modelCode) return [];
    return (await get(modelCode)).fields.map((field) => ({
      label: field.form.title ?? field.table?.title ?? field.key,
      value: field.key,
    }));
  });
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
  runtime.service("model.delete", async (modelCode: string) =>
    transport.send<void>(`/api/v1/models/${encodeURIComponent(modelCode)}`, {
      method: "DELETE",
    }),
  );
}
