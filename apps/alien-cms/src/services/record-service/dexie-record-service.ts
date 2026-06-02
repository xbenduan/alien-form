import dayjs from 'dayjs';
import type { Table } from 'dexie';
import { db, ensureDatabaseReady } from '../db/dexie';
import type { ModelRecord, RuntimeModelRecord } from '../../domains/record/types/record';
import { loadStaticSchema } from '../schema-service/static-schema-service';
import { dexieSchemaService } from '../schema-service/dexie-schema-service';

type SortOrder = 'ascend' | 'descend' | undefined;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getValueByPath(record: Record<string, unknown>, path: string) {
  return path.split('.').reduce<unknown>((currentValue, key) => {
    if (!isPlainObject(currentValue)) {
      return undefined;
    }
    return currentValue[key];
  }, record);
}

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

function matchesValue(recordValue: unknown, filterValue: unknown): boolean {
  if (
    filterValue === undefined ||
    filterValue === null ||
    filterValue === '' ||
    (Array.isArray(filterValue) && filterValue.length === 0)
  ) {
    return true;
  }

  if (typeof filterValue === 'string') {
    return String(recordValue ?? '').toLowerCase().includes(filterValue.toLowerCase());
  }

  if (typeof filterValue === 'boolean' || typeof filterValue === 'number') {
    return recordValue === filterValue;
  }

  if (Array.isArray(filterValue)) {
    return filterValue.every((item) => Array.isArray(recordValue) && recordValue.includes(item));
  }

  return recordValue === filterValue;
}

function matches(record: Record<string, unknown>, filters: Record<string, unknown>): boolean {
  return Object.entries(filters).every(([key, filterValue]) => {
    if (
      filterValue === undefined ||
      filterValue === null ||
      filterValue === '' ||
      (Array.isArray(filterValue) && filterValue.length === 0)
    ) {
      return true;
    }

    return matchesValue(getValueByPath(record, key), filterValue);
  });
}

export class DexieRecordService {
  private readonly tableMap: Record<string, Table<ModelRecord, string>> = {
    'nail-employee': db.employees,
    'nail-service': db.services,
    'nail-booking': db.bookings,
  };

  private getStaticTable(model: string) {
    const table = this.tableMap[model];
    if (!table) {
      throw new Error(`未找到静态模型 "${model}" 对应的数据表，请检查 tableMap 配置`);
    }
    return table;
  }

  private async isRuntimeModel(model: string) {
    if (loadStaticSchema(model)) {
      return false;
    }

    if (await dexieSchemaService.exists(model)) {
      return true;
    }

    throw new Error(`未知模型: ${model}`);
  }

  async list(params: {
    model: string;
    filters?: Record<string, unknown>;
    pagination?: { current: number; pageSize: number };
    sorter?: { field?: string; order?: SortOrder };
  }) {
    await ensureDatabaseReady();
    const { model, filters = {}, pagination = { current: 1, pageSize: 10 }, sorter } = params;
    const runtimeModel = await this.isRuntimeModel(model);
    const table = runtimeModel ? undefined : this.getStaticTable(model);
    const allRows = runtimeModel
      ? await db.modelRecords.where('modelName').equals(model).toArray()
      : await table!.toArray();
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
    const runtimeModel = await this.isRuntimeModel(model);
    const record = runtimeModel ? await db.modelRecords.get(id) : await this.getStaticTable(model)?.get(id);
    if (!record) {
      throw new Error(`未找到记录: ${id}`);
    }
    if (runtimeModel && record.modelName !== model) {
      throw new Error(`未找到记录: ${id}`);
    }
    return record;
  }

  async create(model: string, values: Record<string, unknown>) {
    await ensureDatabaseReady();
    const runtimeModel = await this.isRuntimeModel(model);
    const table = runtimeModel ? undefined : this.getStaticTable(model);
    const now = dayjs().toISOString();
    const baseRecord: ModelRecord = {
      ...(values as ModelRecord),
      id: `${model}-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    const record = runtimeModel
      ? ({
          ...baseRecord,
          modelName: model,
        } satisfies RuntimeModelRecord)
      : baseRecord;
    if (runtimeModel) {
      await db.modelRecords.add(record as RuntimeModelRecord);
    } else {
      await table!.add(record);
    }
    return record;
  }

  async update(model: string, id: string, values: Record<string, unknown>) {
    await ensureDatabaseReady();
    const runtimeModel = await this.isRuntimeModel(model);
    const table = runtimeModel ? undefined : this.getStaticTable(model);
    const current = await this.detail(model, id);
    const nextRecord: ModelRecord = {
      ...current,
      ...values,
      id,
      updatedAt: dayjs().toISOString(),
    };
    if (runtimeModel) {
      await db.modelRecords.put(nextRecord as RuntimeModelRecord);
    } else {
      await table!.put(nextRecord);
    }
    return nextRecord;
  }

  async remove(model: string, id: string) {
    await ensureDatabaseReady();
    const runtimeModel = await this.isRuntimeModel(model);
    if (runtimeModel) {
      await db.modelRecords.delete(id);
      return;
    }
    await this.getStaticTable(model)?.delete(id);
  }
}

export const dexieRecordService = new DexieRecordService();
