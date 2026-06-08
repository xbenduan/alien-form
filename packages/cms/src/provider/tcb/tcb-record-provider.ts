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
import type { FilterItem } from "../../types/common";
import type { TcbClient } from "./tcb-client";

function toTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function buildFilterCondition(db: any, filters?: Record<string, unknown>, typedFilters?: FilterItem[]) {
  const _ = db.command;
  const conditions: any[] = [];

  if (filters) {
    for (const [field, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value) && value.length === 0) continue;

      if (typeof value === "string") {
        conditions.push({ [`data.${field}`]: db.RegExp({ regexp: value, options: "i" }) });
      } else if (Array.isArray(value)) {
        conditions.push({ [`data.${field}`]: _.in(value) });
      } else {
        conditions.push({ [`data.${field}`]: _.eq(value) });
      }
    }
  }

  if (typedFilters) {
    for (const filter of typedFilters) {
      const fieldPath = `data.${filter.field}`;
      switch (filter.operator) {
        case "eq":
          conditions.push({ [fieldPath]: _.eq(filter.value) });
          break;
        case "contains":
          conditions.push({ [fieldPath]: db.RegExp({ regexp: String(filter.value), options: "i" }) });
          break;
        case "gt":
          conditions.push({ [fieldPath]: _.gt(filter.value) });
          break;
        case "gte":
          conditions.push({ [fieldPath]: _.gte(filter.value) });
          break;
        case "lt":
          conditions.push({ [fieldPath]: _.lt(filter.value) });
          break;
        case "lte":
          conditions.push({ [fieldPath]: _.lte(filter.value) });
          break;
        case "in":
          conditions.push({ [fieldPath]: _.in(filter.value as unknown[]) });
          break;
        case "between": {
          const [min, max] = filter.value as [unknown, unknown];
          conditions.push({ [fieldPath]: _.and(_.gte(min), _.lte(max)) });
          break;
        }
      }
    }
  }

  return conditions.length > 0 ? _.and(conditions) : {};
}

function toRecord(doc: any): ModelRecord {
  return {
    id: doc._id,
    ...doc.data,
    createdAt: toTimestamp(doc.createdAt),
    updatedAt: toTimestamp(doc.updatedAt),
  };
}

export class TcbRecordProvider implements RecordProvider {
  private readonly client: TcbClient;
  private readonly db: any;
  private readonly collection: string;

  constructor(client: TcbClient) {
    this.client = client;
    this.db = client.database();
    this.collection = client.collections.records;
  }

  async list(params: RecordListParams): Promise<RecordListResult> {
    const _ = this.db.command;
    const modelCondition = { modelName: _.eq(params.model) };
    const filterCondition = buildFilterCondition(this.db, params.filters, params.typedFilters);

    const where = Object.keys(filterCondition).length > 0
      ? _.and([modelCondition, filterCondition])
      : modelCondition;

    let query = this.db.collection(this.collection).where(where);

    const countResult = await query.count();
    const total = countResult.total;

    if (params.sorter?.field) {
      const order = params.sorter.order === "descend" ? "desc" : "asc";
      query = query.orderBy(`data.${params.sorter.field}`, order);
    } else {
      query = query.orderBy("updatedAt", "desc");
    }

    const current = params.pagination?.current ?? 1;
    const pageSize = params.pagination?.pageSize ?? 10;
    const skip = (current - 1) * pageSize;

    const { data } = await query.skip(skip).limit(pageSize).get();

    return {
      list: data.map(toRecord),
      total,
    };
  }

  async detail(params: RecordDetailParams): Promise<RecordDetailResult> {
    const { data } = await this.db
      .collection(this.collection)
      .doc(params.id)
      .get();

    const doc = data[0] ?? data;
    if (!doc || doc.modelName !== params.model) {
      throw new Error(`Record not found: ${params.id}`);
    }

    return toRecord(doc);
  }

  async create(params: RecordCreateParams): Promise<RecordCreateResult> {
    const now = Date.now();
    const nowText = new Date(now).toISOString();
    const id = `${params.model}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await this.db.collection(this.collection).add({
      _id: id,
      modelName: params.model,
      data: params.values,
      createdAt: nowText,
      updatedAt: nowText,
    });

    return {
      success: true,
      data: { id, ...params.values, createdAt: now, updatedAt: now },
    };
  }

  async update(params: RecordUpdateParams): Promise<RecordUpdateResult> {
    const now = new Date().toISOString();

    const updateFields: Record<string, any> = { updatedAt: now };
    for (const [key, value] of Object.entries(params.values)) {
      updateFields[`data.${key}`] = value;
    }

    await this.db.collection(this.collection).doc(params.id).update(updateFields);

    const { data } = await this.db.collection(this.collection).doc(params.id).get();
    const doc = data[0] ?? data;

    return {
      success: true,
      data: toRecord(doc),
    };
  }

  async delete(params: RecordDeleteParams): Promise<RecordDeleteResult> {
    await this.db.collection(this.collection).doc(params.id).remove();
    return { success: true };
  }

  async batchDelete(params: RecordBatchDeleteParams): Promise<RecordBatchDeleteResult> {
    const _ = this.db.command;

    const { deleted } = await this.db
      .collection(this.collection)
      .where({
        _id: _.in(params.ids),
        modelName: _.eq(params.model),
      })
      .remove();

    return {
      success: true,
      data: { deleted: deleted ?? params.ids.length },
    };
  }
}
