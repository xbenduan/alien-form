import type { ModelRecord, ModelSchema } from "../services/types";
import { nailBookingSchema } from "./schemas/nail-booking";
import { nailEmployeeSchema } from "./schemas/nail-employee";
import { nailServiceSchema } from "./schemas/nail-service";
import { createSeedRecords } from "./seeds";

interface SchemaEntry {
  schema: ModelSchema;
  createdAt: string;
  updatedAt: string;
}

interface MockState {
  schemas: Map<string, SchemaEntry>;
  records: Map<string, Map<string, ModelRecord>>;
}

declare global {
  // eslint-disable-next-line no-var
  var __alienCmsMockStore__: MockState | undefined;
}

function seed(): MockState {
  const now = new Date().toISOString();
  const schemas = new Map<string, SchemaEntry>();
  for (const schema of [nailEmployeeSchema, nailServiceSchema, nailBookingSchema]) {
    schemas.set(schema.meta.name, { schema, createdAt: now, updatedAt: now });
  }

  const records = new Map<string, Map<string, ModelRecord>>();
  for (const [model, list] of Object.entries(createSeedRecords())) {
    records.set(model, new Map(list.map((record) => [record.id, record])));
  }

  return { schemas, records };
}

/** 单例内存态：跨模块共享，HMR / StrictMode 下复用同一份数据。 */
export function getStore(): MockState {
  if (!globalThis.__alienCmsMockStore__) {
    globalThis.__alienCmsMockStore__ = seed();
  }
  return globalThis.__alienCmsMockStore__;
}

// ─── schema ────────────────────────────────────────────────────────────────

export function listSchemaEntries(): SchemaEntry[] {
  return [...getStore().schemas.values()];
}

export function getSchemaEntry(name: string): SchemaEntry | undefined {
  return getStore().schemas.get(name);
}

export function hasSchema(name: string): boolean {
  return getStore().schemas.has(name);
}

export function upsertSchema(schema: ModelSchema): SchemaEntry {
  const store = getStore();
  const now = new Date().toISOString();
  const previous = store.schemas.get(schema.meta.name);
  const entry: SchemaEntry = {
    schema,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  store.schemas.set(schema.meta.name, entry);
  if (!store.records.has(schema.meta.name)) {
    store.records.set(schema.meta.name, new Map());
  }
  return entry;
}

export function removeSchema(name: string): void {
  const store = getStore();
  store.schemas.delete(name);
  store.records.delete(name);
}

// ─── record ──────────────────────────────────────────────────────────────

function recordMap(model: string): Map<string, ModelRecord> {
  const store = getStore();
  if (!store.records.has(model)) store.records.set(model, new Map());
  return store.records.get(model)!;
}

export function listRecordEntries(model: string): ModelRecord[] {
  return [...recordMap(model).values()];
}

export function getRecordEntry(model: string, id: string): ModelRecord | undefined {
  return recordMap(model).get(id);
}

export function upsertRecord(model: string, record: ModelRecord): void {
  recordMap(model).set(record.id, record);
}

export function removeRecord(model: string, id: string): void {
  recordMap(model).delete(id);
}
