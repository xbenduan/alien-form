import dayjs from 'dayjs';
import type { Table } from 'dexie';
import { db, ensureDatabaseReady } from '../db/dexie';
import type { ModelRecord } from '../../types/model';

type SortOrder = 'ascend' | 'descend' | undefined;

function compareValues(left: unknown, right: unknown, order: SortOrder) {
  const leftValue = left ?? '';
  const rightValue = right ?? '';
  const normalizedLeft = typeof leftValue === 'string' ? leftValue.toLowerCase() : leftValue;
  const normalizedRight = typeof rightValue === 'string' ? rightValue.toLowerCase() : rightValue;

  if (normalizedLeft === normalizedRight) {
    return 0;
  }

  if (normalizedLeft > normalizedRight) {
    return order === 'descend' ? -1 : 1;
  }

  return order === 'descend' ? 1 : -1;
}

function matches(record: ModelRecord, filters: Record<string, unknown>) {
  return Object.entries(filters).every(([key, rawFilterValue]) => {
    if (
      rawFilterValue === undefined ||
      rawFilterValue === null ||
      rawFilterValue === '' ||
      (Array.isArray(rawFilterValue) && rawFilterValue.length === 0)
    ) {
      return true;
    }

    const recordValue = record[key];

    if (typeof rawFilterValue === 'string') {
      return String(recordValue ?? '').toLowerCase().includes(rawFilterValue.toLowerCase());
    }

    if (typeof rawFilterValue === 'boolean' || typeof rawFilterValue === 'number') {
      return recordValue === rawFilterValue;
    }

    if (Array.isArray(rawFilterValue)) {
      return rawFilterValue.every((item) => Array.isArray(recordValue) && recordValue.includes(item));
    }

    return recordValue === rawFilterValue;
  });
}

export class DexieRepository {
  private readonly tableMap: Record<string, Table<ModelRecord, string>> = {
    article: db.articles,
    campaign: db.campaigns,
    'nail-booking': db.nailBookings,
  };

  private getTable(model: string) {
    const table = this.tableMap[model];
    if (!table) {
      throw new Error(`未知模型: ${model}`);
    }
    return table;
  }

  async list(params: {
    model: string;
    filters?: Record<string, unknown>;
    pagination?: { current: number; pageSize: number };
    sorter?: { field?: string; order?: SortOrder };
  }) {
    await ensureDatabaseReady();
    const { model, filters = {}, pagination = { current: 1, pageSize: 10 }, sorter } = params;
    const table = this.getTable(model);
    const allRows = await table.toArray();
    const filteredRows = allRows.filter((record) => matches(record, filters));

    if (sorter?.field && sorter.order) {
      const sortField = sorter.field;
      const sortOrder = sorter.order;
      filteredRows.sort((left, right) => compareValues(left[sortField], right[sortField], sortOrder));
    } else {
      filteredRows.sort((left, right) => compareValues(left.updatedAt, right.updatedAt, 'descend'));
    }

    const start = (pagination.current - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;

    return {
      list: filteredRows.slice(start, end),
      total: filteredRows.length,
    };
  }

  async detail(model: string, id: string) {
    await ensureDatabaseReady();
    const table = this.getTable(model);
    const record = await table.get(id);
    if (!record) {
      throw new Error(`未找到记录: ${id}`);
    }
    return record;
  }

  async create(model: string, values: Record<string, unknown>) {
    await ensureDatabaseReady();
    const table = this.getTable(model);
    const now = dayjs().toISOString();
    const record: ModelRecord = {
      ...(values as ModelRecord),
      id: `${model}-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    await table.add(record);
    return record;
  }

  async update(model: string, id: string, values: Record<string, unknown>) {
    await ensureDatabaseReady();
    const table = this.getTable(model);
    const current = await this.detail(model, id);
    const nextRecord: ModelRecord = {
      ...current,
      ...values,
      id,
      updatedAt: dayjs().toISOString(),
    };
    await table.put(nextRecord);
    return nextRecord;
  }

  async remove(model: string, id: string) {
    await ensureDatabaseReady();
    const table = this.getTable(model);
    await table.delete(id);
  }
}
