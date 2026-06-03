import type { RecordProvider } from "../record-provider";
import type {
  RecordListParams,
  RecordListResult,
  RecordDetailParams,
  RecordDetailResult,
  RecordCreateParams,
  RecordCreateResult,
  RecordUpdateParams,
  RecordUpdateResult,
  RecordDeleteParams,
  RecordDeleteResult,
  RecordBatchDeleteParams,
  RecordBatchDeleteResult,
  ModelRecord,
} from "../../types/record";
import {
  batchDeleteRecordEntries,
  deleteRecordEntry,
  ensureLocalMemory,
  getRecordEntry,
  hasSchemaEntry,
  listRecordEntries,
  upsertRecordEntry,
} from "./memory-store";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getValueByPath(record: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((currentValue, key) => {
    if (!isPlainObject(currentValue)) {
      return undefined;
    }
    return currentValue[key];
  }, record);
}

function compareValues(left: unknown, right: unknown, order: "ascend" | "descend" | undefined) {
  const leftValue = left ?? "";
  const rightValue = right ?? "";
  const normalizedLeft = typeof leftValue === "string" ? leftValue.toLowerCase() : leftValue;
  const normalizedRight = typeof rightValue === "string" ? rightValue.toLowerCase() : rightValue;

  if (normalizedLeft === normalizedRight) {
    return 0;
  }

  if (normalizedLeft > normalizedRight) {
    return order === "descend" ? -1 : 1;
  }

  return order === "descend" ? 1 : -1;
}

function matchesValue(recordValue: unknown, filterValue: unknown): boolean {
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

function matches(record: Record<string, unknown>, filters: Record<string, unknown>) {
  return Object.entries(filters).every(([key, filterValue]) => matchesValue(getValueByPath(record, key), filterValue));
}

function createRecordId(model: string) {
  return `${model}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface LocalRecordProviderOptions {
  seedDemo?: boolean;
}

export class LocalRecordProvider implements RecordProvider {
  constructor(options: LocalRecordProviderOptions = {}) {
    ensureLocalMemory(options.seedDemo ?? true);
  }

  async list(params: RecordListParams): Promise<RecordListResult> {
    if (!hasSchemaEntry(params.model)) {
      throw new Error(`Unknown model: ${params.model}`);
    }

    const filters = params.filters ?? {};
    const pagination = params.pagination ?? { current: 1, pageSize: 10 };
    const records = listRecordEntries(params.model).filter((record) => matches(record, filters));

    if (params.sorter?.field && params.sorter.order) {
      records.sort((left, right) => compareValues(left[params.sorter!.field], right[params.sorter!.field], params.sorter!.order));
    } else {
      records.sort((left, right) => compareValues(left.updatedAt, right.updatedAt, "descend"));
    }

    const start = (pagination.current - 1) * pagination.pageSize;
    return {
      list: records.slice(start, start + pagination.pageSize),
      total: records.length,
    };
  }

  async detail(params: RecordDetailParams): Promise<RecordDetailResult> {
    const record = getRecordEntry(params.model, params.id);
    if (!record) {
      throw new Error(`Record not found: ${params.id}`);
    }
    return record;
  }

  async create(params: RecordCreateParams): Promise<RecordCreateResult> {
    if (!hasSchemaEntry(params.model)) {
      throw new Error(`Unknown model: ${params.model}`);
    }

    const now = new Date().toISOString();
    const record: ModelRecord = {
      id: createRecordId(params.model),
      ...params.values,
      createdAt: now,
      updatedAt: now,
    };
    upsertRecordEntry(params.model, record);
    return { success: true, data: record };
  }

  async update(params: RecordUpdateParams): Promise<RecordUpdateResult> {
    const current = getRecordEntry(params.model, params.id);
    if (!current) {
      throw new Error(`Record not found: ${params.id}`);
    }

    const nextRecord: ModelRecord = {
      ...current,
      ...params.values,
      id: params.id,
      updatedAt: new Date().toISOString(),
    };
    upsertRecordEntry(params.model, nextRecord);
    return { success: true, data: nextRecord };
  }

  async delete(params: RecordDeleteParams): Promise<RecordDeleteResult> {
    deleteRecordEntry(params.model, params.id);
    return { success: true };
  }

  async batchDelete(params: RecordBatchDeleteParams): Promise<RecordBatchDeleteResult> {
    const deleted = batchDeleteRecordEntries(params.model, params.ids);
    return { success: true, data: { deleted } };
  }
}
