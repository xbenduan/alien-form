import type { ModelRecord } from "../../types/record";
import type { CmsModelSchema } from "../../types/schema";
import { listDemoSchemas } from "./demo-schema-loader";
import { createDemoRecords } from "./seeds";

const MAX_MODELS = 5;
const MAX_RECORDS_PER_MODEL = 10;

type SchemaSource = "static" | "runtime";

export interface MemorySchemaEntry {
  modelName: string;
  schema: CmsModelSchema;
  source: SchemaSource;
  createdAt: string;
  updatedAt: string;
}

interface LocalMemoryState {
  initialized: boolean;
  seededDemo: boolean;
  schemas: Map<string, MemorySchemaEntry>;
  records: Map<string, Map<string, ModelRecord>>;
}

declare global {
  var __alienCmsLocalMemoryStore__: LocalMemoryState | undefined;
}

function createState(): LocalMemoryState {
  return {
    initialized: false,
    seededDemo: false,
    schemas: new Map(),
    records: new Map(),
  };
}

function getState() {
  if (!globalThis.__alienCmsLocalMemoryStore__) {
    globalThis.__alienCmsLocalMemoryStore__ = createState();
  }
  return globalThis.__alienCmsLocalMemoryStore__;
}

function createSchemaEntry(modelName: string, schema: CmsModelSchema, source: SchemaSource): MemorySchemaEntry {
  const now = new Date().toISOString();
  return {
    modelName,
    schema,
    source,
    createdAt: now,
    updatedAt: now,
  };
}

function seedDemoData(state: LocalMemoryState) {
  const demoSchemas = listDemoSchemas();
  const demoRecords = createDemoRecords();

  for (const { modelName, schema } of demoSchemas) {
    state.schemas.set(modelName, createSchemaEntry(modelName, schema, "static"));
  }

  for (const [modelName, records] of Object.entries(demoRecords)) {
    state.records.set(modelName, new Map(records.map((record) => [record.id, record])));
  }
}

export function resetLocalMemory(seedDemo: boolean) {
  const state = getState();
  state.initialized = true;
  state.seededDemo = seedDemo;
  state.schemas = new Map();
  state.records = new Map();

  if (seedDemo) {
    seedDemoData(state);
  }

  return state;
}

export function ensureLocalMemory(seedDemo: boolean) {
  const state = getState();
  if (!state.initialized) {
    return resetLocalMemory(seedDemo);
  }

  if (seedDemo && !state.seededDemo && state.schemas.size === 0 && state.records.size === 0) {
    return resetLocalMemory(true);
  }

  return state;
}

export function listSchemaEntries() {
  return [...getState().schemas.values()];
}

export function getSchemaEntry(modelName: string) {
  return getState().schemas.get(modelName);
}

export function hasSchemaEntry(modelName: string) {
  return getState().schemas.has(modelName);
}

export function upsertSchemaEntry(entry: MemorySchemaEntry) {
  const state = getState();
  const exists = state.schemas.has(entry.modelName);
  const previous = state.schemas.get(entry.modelName);
  state.schemas.set(entry.modelName, {
    ...entry,
    createdAt: previous?.createdAt ?? entry.createdAt,
    updatedAt: new Date().toISOString(),
  });

  while (!exists && state.schemas.size > MAX_MODELS) {
    const oldestModelName = state.schemas.keys().next().value as string | undefined;
    if (!oldestModelName) break;
    state.schemas.delete(oldestModelName);
    state.records.delete(oldestModelName);
  }
}

export function deleteSchemaEntry(modelName: string) {
  const state = getState();
  state.schemas.delete(modelName);
  state.records.delete(modelName);
}

function getOrCreateRecordMap(modelName: string) {
  const state = getState();
  if (!state.records.has(modelName)) {
    state.records.set(modelName, new Map());
  }
  return state.records.get(modelName)!;
}

export function listRecordEntries(modelName: string) {
  return [...(getState().records.get(modelName)?.values() ?? [])];
}

export function getRecordEntry(modelName: string, id: string) {
  return getState().records.get(modelName)?.get(id);
}

export function upsertRecordEntry(modelName: string, record: ModelRecord) {
  const recordMap = getOrCreateRecordMap(modelName);
  const exists = recordMap.has(record.id);
  recordMap.set(record.id, record);

  while (!exists && recordMap.size > MAX_RECORDS_PER_MODEL) {
    const oldestRecordId = recordMap.keys().next().value as string | undefined;
    if (!oldestRecordId) break;
    recordMap.delete(oldestRecordId);
  }
}

export function deleteRecordEntry(modelName: string, id: string) {
  getState().records.get(modelName)?.delete(id);
}

export function batchDeleteRecordEntries(modelName: string, ids: string[]) {
  const recordMap = getState().records.get(modelName);
  if (!recordMap) return 0;

  let deleted = 0;
  for (const id of ids) {
    if (recordMap.delete(id)) {
      deleted += 1;
    }
  }

  return deleted;
}
