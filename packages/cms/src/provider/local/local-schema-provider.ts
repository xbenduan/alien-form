import type { SchemaProvider } from "../schema-provider";
import type {
  SchemaListParams,
  SchemaListResult,
  SchemaDetailParams,
  SchemaDetailResult,
  SchemaCreateParams,
  SchemaCreateResult,
  SchemaUpdateParams,
  SchemaUpdateResult,
  SchemaDeleteParams,
  SchemaDeleteResult,
  ModelSummary,
  CmsModelSchema,
} from "../../types/schema";

interface StoredSchema {
  modelName: string;
  title: string;
  subtitle?: string;
  description?: string;
  schema: CmsModelSchema;
  source: "runtime" | "static";
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "alien-cms:local-schemas";

function readStore(): Map<string, StoredSchema> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const arr: StoredSchema[] = JSON.parse(raw);
    return new Map(arr.map((item) => [item.modelName, item]));
  } catch {
    return new Map();
  }
}

function writeStore(store: Map<string, StoredSchema>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...store.values()]));
}

function toSummary(item: StoredSchema): ModelSummary {
  return {
    name: item.modelName,
    title: item.title,
    subtitle: item.subtitle,
    description: item.description,
    source: item.source,
    fieldCount: item.schema?.properties ? Object.keys(item.schema.properties).length : undefined,
    updatedAt: item.updatedAt,
  };
}

/**
 * Local (localStorage-based) SchemaProvider for demo/offline mode.
 * No external dependencies. Data persists in the browser.
 */
export class LocalSchemaProvider implements SchemaProvider {
  async list(params?: SchemaListParams): Promise<SchemaListResult> {
    const store = readStore();
    let items = [...store.values()].filter((item) => !item.deleted);

    if (params?.keyword) {
      const kw = params.keyword.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(kw) ||
          item.modelName.toLowerCase().includes(kw) ||
          (item.description ?? "").toLowerCase().includes(kw)
      );
    }

    items.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));

    const total = items.length;
    const current = params?.pagination?.current ?? 1;
    const pageSize = params?.pagination?.pageSize ?? total || 1;
    const start = (current - 1) * pageSize;

    return {
      list: items.slice(start, start + pageSize).map(toSummary),
      total,
    };
  }

  async detail(params: SchemaDetailParams): Promise<SchemaDetailResult> {
    const store = readStore();
    const item = store.get(params.modelName);

    if (!item || item.deleted) {
      throw new Error(`Schema not found: ${params.modelName}`);
    }

    return item.schema;
  }

  async create(params: SchemaCreateParams): Promise<SchemaCreateResult> {
    const store = readStore();
    const schema = params.schema;
    const modelName = schema["x-model"]?.name ?? "unknown";
    const now = new Date().toISOString();

    if (store.has(modelName) && !store.get(modelName)!.deleted) {
      throw new Error(`Schema already exists: ${modelName}`);
    }

    const record: StoredSchema = {
      modelName,
      title: schema["x-model"]?.title ?? schema.title ?? modelName,
      subtitle: schema["x-model"]?.subtitle,
      description: schema["x-model"]?.description ?? schema.description,
      schema,
      source: "runtime",
      deleted: false,
      createdAt: now,
      updatedAt: now,
    };

    store.set(modelName, record);
    writeStore(store);

    return {
      success: true,
      data: toSummary(record),
    };
  }

  async update(params: SchemaUpdateParams): Promise<SchemaUpdateResult> {
    const store = readStore();
    const { modelName, schema } = params;
    const existing = store.get(modelName);
    const now = new Date().toISOString();

    const record: StoredSchema = {
      modelName,
      title: schema["x-model"]?.title ?? schema.title ?? modelName,
      subtitle: schema["x-model"]?.subtitle,
      description: schema["x-model"]?.description ?? schema.description,
      schema,
      source: existing?.source ?? "runtime",
      deleted: false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    store.set(modelName, record);
    writeStore(store);

    return {
      success: true,
      data: toSummary(record),
    };
  }

  async delete(params: SchemaDeleteParams): Promise<SchemaDeleteResult> {
    const store = readStore();
    const item = store.get(params.modelName);

    if (item) {
      item.deleted = true;
      item.updatedAt = new Date().toISOString();
      writeStore(store);
    }

    return { success: true };
  }

  async exists(modelName: string): Promise<boolean> {
    const store = readStore();
    const item = store.get(modelName);
    return Boolean(item && !item.deleted);
  }
}
