import { defineService, type Runtime } from "@alien-form/engine";
import { parseAlienSchema, parseModelSummaries, type AlienSchema } from "@alien-form/protocol";
import { sdkClient } from "@runtime/sdk-client";

export function registerModelServices(runtime: Runtime): void {
  const list = async () => parseModelSummaries(await sdkClient.models.list());
  const get = async (modelCode: string) =>
    parseAlienSchema(await sdkClient.models.get(modelCode));

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
        parseAlienSchema(await sdkClient.models.create(schema)),
      { description: "创建模型" },
    ),
  );
  runtime.service(
    "model.update",
    defineService(
      async (modelCode: string, schema: AlienSchema) =>
        parseAlienSchema(await sdkClient.models.update(modelCode, schema)),
      { description: "更新模型" },
    ),
  );
  runtime.service(
    "model.delete",
    defineService(
      async (modelCode: string) =>
        sdkClient.models.delete(modelCode),
      { description: "删除模型" },
    ),
  );
}
