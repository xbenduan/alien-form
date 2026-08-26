import type { Runtime } from "@alien-form/engine";
import { SchemaCompiler } from "./shared";
import type { ModelSchema } from "./shared";

export function createAppCompiler(
  runtime: Runtime,
  locale = "zh",
  domain?: string,
): SchemaCompiler {
  return new SchemaCompiler({
    service: ((code: string) => runtime.registry.services.resolve(code) ?? undefined) as (code: string) => { send: (params?: unknown) => Promise<unknown> } | undefined,
    constant: (key) => runtime.registry.constants.resolve(key, domain),
    loadSchema: async (modelCode): Promise<ModelSchema> => {
      const service = runtime.registry.services.resolve("schema.get");
      if (!service) throw new Error("[alien-mdm] service schema.get not registered");
      return (await service.send({ name: modelCode })) as ModelSchema;
    },
    locale,
  });
}
