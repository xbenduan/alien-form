import dayjs from 'dayjs';
import type { Table } from 'dexie';
import { db, ensureDatabaseReady } from '../db/dexie';
import type { ModelRecord, RuntimeModelRecord } from '../../types/model';
import { loadStaticSchema } from '../schema/static-schema-source';
import { modelSchemaRepository } from './model-schema-repository';

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

    if (await modelSchemaRepository.exists(model)) {
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
