import {
  getSchemaEntry,
  hasSchema,
  listSchemaEntries,
  removeSchema,
  upsertSchema,
} from "../mock/store";
import type { ModelSchema, ModelSummary } from "./types";

/** 模拟网络延迟，让 loading 态可见。 */
function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** 列出所有模型摘要（落地页 / 列表用）。 */
export function listSchemas(): Promise<ModelSummary[]> {
  const summaries = listSchemaEntries()
    .map(({ schema, updatedAt }) => ({
      name: schema.meta.name,
      title: schema.meta.title,
      subtitle: schema.meta.subtitle,
      description: schema.meta.description,
      fieldCount: Object.keys(schema.properties ?? {}).length,
      updatedAt,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return delay(summaries);
}

export async function getSchema(name: string): Promise<ModelSchema> {
  const entry = getSchemaEntry(name);
  if (!entry) throw new Error(`模型不存在：${name}`);
  return delay(entry.schema);
}

export async function createSchema(schema: ModelSchema): Promise<ModelSchema> {
  if (hasSchema(schema.meta.name)) throw new Error(`模型已存在：${schema.meta.name}`);
  const entry = upsertSchema(schema);
  return delay(entry.schema);
}

export async function updateSchema(name: string, schema: ModelSchema): Promise<ModelSchema> {
  if (!hasSchema(name)) throw new Error(`模型不存在：${name}`);
  const entry = upsertSchema({ ...schema, meta: { ...schema.meta, name } });
  return delay(entry.schema);
}

export async function deleteSchema(name: string): Promise<void> {
  removeSchema(name);
  return delay(undefined);
}
