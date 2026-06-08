import type { SchemaProvider } from "../schema-provider";
import type {
  SchemaListParams,
  SchemaListFilters,
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
import { normalizeSchema } from "../../schema/normalize-schema";
import {
  deleteSchemaEntry,
  ensureLocalMemory,
  getSchemaEntry,
  hasSchemaEntry,
  listSchemaEntries,
  type MemorySchemaEntry,
  upsertSchemaEntry,
} from "./memory-store";

function toSummary(item: MemorySchemaEntry): ModelSummary {
  return {
    name: item.modelName,
    title: item.schema["x-model"]?.title ?? item.schema.title ?? item.modelName,
    subtitle: item.schema["x-model"]?.subtitle,
    description: item.schema["x-model"]?.description ?? item.schema.description,
    source: item.source,
    fieldCount: Object.keys(item.schema.properties ?? {}).length,
    updatedAt: item.updatedAt,
  };
}

function matchesFilterValue(value: string | undefined, filterValue?: string): boolean {
  const normalizedFilterValue = filterValue?.trim().toLowerCase();
  if (!normalizedFilterValue) {
    return true;
  }

  return String(value ?? "").toLowerCase().includes(normalizedFilterValue);
}

function matchesFilters(item: MemorySchemaEntry, filters?: SchemaListFilters): boolean {
  if (!filters) {
    return true;
  }

  const summary = toSummary(item);
  return (
    matchesFilterValue(summary.name, filters.name) &&
    matchesFilterValue(summary.title, filters.title) &&
    matchesFilterValue(summary.description, filters.description) &&
    matchesFilterValue(summary.source, filters.source)
  );
}

function toEntry(schema: CmsModelSchema, source: "static" | "runtime", existing?: MemorySchemaEntry): MemorySchemaEntry {
  const normalized = normalizeSchema(schema as never) as unknown as CmsModelSchema;
  const modelName = normalized["x-model"]?.name ?? "unknown";
  const now = new Date().toISOString();
  return {
    modelName,
    schema: normalized,
    source,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export interface LocalSchemaProviderOptions {
  seedDemo?: boolean;
}

export class LocalSchemaProvider implements SchemaProvider {
  constructor(options: LocalSchemaProviderOptions = {}) {
    ensureLocalMemory(options.seedDemo ?? true);
  }

  async list(params?: SchemaListParams): Promise<SchemaListResult> {
    let items = listSchemaEntries();

    if (params?.filters) {
      items = items.filter((item) => matchesFilters(item, params.filters));
    } else if (params?.keyword) {
      const keyword = params.keyword.trim().toLowerCase();
      items = items.filter((item) =>
        [item.modelName, item.schema.title, item.schema["x-model"]?.title, item.schema.description, item.schema["x-model"]?.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword)),
      );
    }

    items.sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""));

    const total = items.length;
    const current = params?.pagination?.current ?? 1;
    const pageSize = (params?.pagination?.pageSize ?? total) || 1;
    const start = (current - 1) * pageSize;

    return {
      list: items.slice(start, start + pageSize).map(toSummary),
      total,
    };
  }

  async detail(params: SchemaDetailParams): Promise<SchemaDetailResult> {
    const entry = getSchemaEntry(params.modelName);
    if (!entry) {
      throw new Error(`Schema not found: ${params.modelName}`);
    }
    return entry.schema;
  }

  async create(params: SchemaCreateParams): Promise<SchemaCreateResult> {
    const schema = normalizeSchema(params.schema as never) as unknown as CmsModelSchema;
    const modelName = schema["x-model"]?.name ?? "unknown";

    if (hasSchemaEntry(modelName)) {
      throw new Error(`Schema already exists: ${modelName}`);
    }

    const entry = toEntry(schema, "runtime");
    upsertSchemaEntry(entry);
    return { success: true, data: toSummary(entry) };
  }

  async update(params: SchemaUpdateParams): Promise<SchemaUpdateResult> {
    const existing = getSchemaEntry(params.modelName);
    if (!existing) {
      throw new Error(`Schema not found: ${params.modelName}`);
    }

    const normalized = normalizeSchema(params.schema as never) as unknown as CmsModelSchema;
    const entry = toEntry(
      {
        ...normalized,
        "x-model": {
          ...normalized["x-model"],
          name: params.modelName,
        },
      },
      existing.source === "static" ? "static" : "runtime",
      existing,
    );

    upsertSchemaEntry(entry);
    return { success: true, data: toSummary(entry) };
  }

  async delete(params: SchemaDeleteParams): Promise<SchemaDeleteResult> {
    deleteSchemaEntry(params.modelName);
    return { success: true };
  }

  async exists(modelName: string): Promise<boolean> {
    return hasSchemaEntry(modelName);
  }
}
