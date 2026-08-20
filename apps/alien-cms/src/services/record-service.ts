import {
  getRecordEntry,
  hasSchema,
  listRecordEntries,
  removeRecord,
  removeRecords,
  upsertRecord,
} from "../mock/store";
import type {
  ModelRecord,
  RecordListParams,
  RecordListResult,
} from "./types";

function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function matchValue(recordValue: unknown, filterValue: unknown): boolean {
  if (
    filterValue === undefined ||
    filterValue === null ||
    filterValue === "" ||
    (Array.isArray(filterValue) && filterValue.length === 0)
  ) {
    return true;
  }
  if (typeof filterValue === "string") {
    return String(recordValue ?? "").toLowerCase().includes(filterValue.toLowerCase());
  }
  if (typeof filterValue === "boolean" || typeof filterValue === "number") {
    return recordValue === filterValue;
  }
  if (Array.isArray(filterValue)) {
    return filterValue.every((item) => Array.isArray(recordValue) && recordValue.includes(item));
  }
  return recordValue === filterValue;
}

function compare(left: unknown, right: unknown, order: "ascend" | "descend"): number {
  const a = left ?? "";
  const b = right ?? "";
  const na = typeof a === "string" ? a.toLowerCase() : a;
  const nb = typeof b === "string" ? b.toLowerCase() : b;
  if (na === nb) return 0;
  const result = na > nb ? 1 : -1;
  return order === "descend" ? -result : result;
}

export function listRecords(params: RecordListParams): Promise<RecordListResult> {
  if (!hasSchema(params.model)) throw new Error(`未知模型：${params.model}`);

  const filters = params.filters ?? {};
  let records = listRecordEntries(params.model).filter((record) =>
    Object.entries(filters).every(([key, value]) => matchValue(record[key], value)),
  );

  if (params.sorter) {
    const { field, order } = params.sorter;
    records = [...records].sort((a, b) => compare(a[field], b[field], order));
  } else {
    records = [...records].sort((a, b) => compare(a.updatedAt, b.updatedAt, "descend"));
  }

  const total = records.length;
  const pagination = params.pagination ?? { current: 1, pageSize: 10 };
  const start = (pagination.current - 1) * pagination.pageSize;
  return delay({ list: records.slice(start, start + pagination.pageSize), total });
}

export async function getRecord(model: string, id: string): Promise<ModelRecord> {
  const record = getRecordEntry(model, id);
  if (!record) throw new Error(`记录不存在：${id}`);
  return delay(record);
}

function createId(model: string): string {
  return `${model}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createRecord(
  model: string,
  values: Record<string, unknown>,
): Promise<ModelRecord> {
  if (!hasSchema(model)) throw new Error(`未知模型：${model}`);
  const now = Date.now();
  const record: ModelRecord = { ...values, id: createId(model), createdAt: now, updatedAt: now };
  upsertRecord(model, record);
  return delay(record);
}

export async function updateRecord(
  model: string,
  id: string,
  values: Record<string, unknown>,
): Promise<ModelRecord> {
  const current = getRecordEntry(model, id);
  if (!current) throw new Error(`记录不存在：${id}`);
  const record: ModelRecord = { ...current, ...values, id, updatedAt: Date.now() };
  upsertRecord(model, record);
  return delay(record);
}

export async function deleteRecord(model: string, id: string): Promise<void> {
  removeRecord(model, id);
  return delay(undefined);
}

export async function deleteRecords(model: string, ids: string[]): Promise<void> {
  if (!hasSchema(model)) throw new Error(`未知模型：${model}`);
  removeRecords(model, ids);
  return delay(undefined);
}
