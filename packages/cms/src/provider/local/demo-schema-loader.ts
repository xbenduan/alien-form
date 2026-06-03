import { normalizeSchema } from "../../schema/normalize-schema";
import type { CmsModelSchema, ModelSummary } from "../../types/schema";

const schemaModules = import.meta.glob("./schema/*.json", { eager: true });

function extractModelName(filePath: string) {
  return filePath.match(/\/([^/]+)\.json$/)?.[1];
}

function getRawSchema(mod: unknown) {
  return ((mod as { default?: CmsModelSchema }).default ?? mod) as CmsModelSchema;
}

export interface DemoSchemaEntry {
  modelName: string;
  schema: CmsModelSchema;
}

export function listDemoSchemas(): DemoSchemaEntry[] {
  return Object.entries(schemaModules)
    .map(([filePath, mod]) => {
      const schema = normalizeSchema(getRawSchema(mod) as never) as unknown as CmsModelSchema;
      return {
        modelName: extractModelName(filePath) ?? schema["x-model"]?.name ?? "unknown",
        schema,
      };
    })
    .sort((left, right) => left.modelName.localeCompare(right.modelName));
}

export function listDemoModelSummaries(): ModelSummary[] {
  return listDemoSchemas().map(({ modelName, schema }) => ({
    name: modelName,
    title: schema["x-model"]?.title ?? schema.title ?? modelName,
    subtitle: schema["x-model"]?.subtitle,
    description: schema["x-model"]?.description ?? schema.description,
    source: "static",
    fieldCount: Object.keys(schema.properties ?? {}).length,
  }));
}

export function getDefaultDemoModelName() {
  return listDemoSchemas()[0]?.modelName;
}

export function loadDemoSchema(modelName: string): CmsModelSchema | undefined {
  return listDemoSchemas().find((item) => item.modelName === modelName)?.schema;
}
