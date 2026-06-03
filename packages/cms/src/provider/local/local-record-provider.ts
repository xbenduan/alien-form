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

const STORAGE_KEY = "alien-cms:local-records";

function readStore(): ModelRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStore(records: ModelRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function matchesFilter(record: ModelRecord, filters: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;

    const recordValue = record[key];

    if (typeof value === "string") {
      if (!String(recordValue ?? "").toLowerCase().includes(value.toLowerCase())) return false;
    } else if (typeof value === "boolean" || typeof value === "number") {
      if (recordValue !== value) return false;
    } else if (Array.isArray(value)) {
      if (!Array.isArray(recordValue) || !value.every((v) => recordValue.includes(v))) return false;
    } else {
      if (recordValue !== value) return false;
    }
  }
  return true;
}

/**
 * Local (localStorage-based) RecordProvider for demo/offline mode.
 * Records are stored as a flat array with a `_modelName` field for filtering.
 */
export class LocalRecordProvider implements RecordProvider {
  async list(params: RecordListParams): Promise<RecordListResult> {
    const allRecords = readStore();
    let records = allRecords.filter((r) => (r as any)._modelName === params.model);

    // Apply filters
    if (params.filters) {
      records = records.filter((r) => matchesFilter(r, params.filters!));
    }

    // Sorting
    if (params.sorter?.field) {
      const field = params.sorter.field;
      const desc = params.sorter.order === "descend";
      records.sort((a, b) => {
        const av = String(a[field] ?? "");
        const bv = String(b[field] ?? "");
        const cmp = av.localeCompare(bv);
        return desc ? -cmp : cmp;
      });
    } else {
      records.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    }

    const total = records.length;
    const current = params.pagination?.current ?? 1;
    const pageSize = params.pagination?.pageSize ?? 10;
    const start = (current - 1) * pageSize;

    return {
      list: records.slice(start, start + pageSize),
      total,
    };
  }

  async detail(params: RecordDetailParams): Promise<RecordDetailResult> {
    const records = readStore();
    const record = records.find((r) => r.id === params.id && (r as any)._modelName === params.model);

    if (!record) {
      throw new Error(`Record not found: ${params.id}`);
    }

    return record;
  }

  async create(params: RecordCreateParams): Promise<RecordCreateResult> {
    const records = readStore();
    const now = new Date().toISOString();
    const id = `${params.model}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const record: ModelRecord = {
      id,
      ...params.values,
      _modelName: params.model,
      createdAt: now,
      updatedAt: now,
    } as any;

    records.push(record);
    writeStore(records);

    return { success: true, data: record };
  }

  async update(params: RecordUpdateParams): Promise<RecordUpdateResult> {
    const records = readStore();
    const index = records.findIndex((r) => r.id === params.id && (r as any)._modelName === params.model);

    if (index === -1) {
      throw new Error(`Record not found: ${params.id}`);
    }

    const now = new Date().toISOString();
    records[index] = { ...records[index], ...params.values, updatedAt: now };
    writeStore(records);

    return { success: true, data: records[index] };
  }

  async delete(params: RecordDeleteParams): Promise<RecordDeleteResult> {
    const records = readStore();
    const filtered = records.filter((r) => !(r.id === params.id && (r as any)._modelName === params.model));
    writeStore(filtered);

    return { success: true };
  }

  async batchDelete(params: RecordBatchDeleteParams): Promise<RecordBatchDeleteResult> {
    const records = readStore();
    const idSet = new Set(params.ids);
    const filtered = records.filter((r) => !((r as any)._modelName === params.model && idSet.has(r.id)));
    const deleted = records.length - filtered.length;
    writeStore(filtered);

    return { success: true, data: { deleted } };
  }
}
