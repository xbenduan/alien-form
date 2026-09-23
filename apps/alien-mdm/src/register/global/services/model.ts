import { defineService, type Runtime } from "@alien-form/engine";
import { parseAlienSchema, parseModelSummaries, type AlienSchema } from "@alien-form/protocol";
import { transport } from "@runtime/transport";

export function registerModelServices(runtime: Runtime): void {
  const list = async () => parseModelSummaries(await transport.send<unknown>("/api/v1/models"));
  const get = async (modelCode: string) =>
    parseAlienSchema(await transport.send<unknown>(`/api/v1/models/${modelCode}`));

  runtime.service("model.list", defineService(list, { description: "查询模型列表" }));
  runtime.service("model.get", defineService(get, { description: "读取模型" }));
  runtime.service(
    "model.options",
    defineService(
      async () => (await list()).map((model) => ({ label: model.title, value: model.name })),
      { description: "查询模型选项" },
    ),
  );
  runtime.service(
    "model.fieldOptions",
    defineService(
      async (modelCode: string | undefined) => {
        if (!modelCode) return [];
        return (await get(modelCode)).fields.map((field) => ({
          label: field.title ?? field.table?.title ?? field.key,
          value: field.key,
        }));
      },
      { description: "查询模型字段选项" },
    ),
  );
  runtime.service(
    "model.create",
    defineService(
      async (schema: AlienSchema) =>
        parseAlienSchema(
          await transport.send<unknown>("/api/v1/models", {
            method: "POST",
            body: JSON.stringify(schema),
          }),
        ),
      { description: "创建模型" },
    ),
  );
  runtime.service(
    "model.update",
    defineService(
      async (modelCode: string, schema: AlienSchema) =>
        parseAlienSchema(
          await transport.send<unknown>(`/api/v1/models/${modelCode}`, {
            method: "PUT",
            body: JSON.stringify(schema),
          }),
        ),
      { description: "更新模型" },
    ),
  );
  runtime.service(
    "model.delete",
    defineService(
      async (modelCode: string) =>
        transport.send<void>(`/api/v1/models/${encodeURIComponent(modelCode)}`, {
          method: "DELETE",
        }),
      { description: "删除模型" },
    ),
  );
}
