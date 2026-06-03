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
import type { SupabaseProvider } from "./supabase-client";

function applyTypedFilter(query: any, filter: FilterItem) {
  const field = `data->>${filter.field}`;
  const jsonField = `data->${filter.field}`;

  switch (filter.operator) {
    case "eq":
      return query.eq(field, filter.value);
    case "contains":
      return query.ilike(field, `%${filter.value}%`);
    case "gt":
      return query.gt(field, filter.value);
    case "gte":
      return query.gte(field, filter.value);
    case "lt":
      return query.lt(field, filter.value);
    case "lte":
      return query.lte(field, filter.value);
    case "in":
      return query.in(field, filter.value as unknown[]);
    case "between": {
      const [min, max] = filter.value as [unknown, unknown];
      return query.gte(field, min).lte(field, max);
    }
    default:
      return query;
  }
}

function toRecord(row: any): ModelRecord {
  return {
    id: row.id,
    ...row.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseRecordProvider implements RecordProvider {
  private readonly client: any;
  private readonly table: string;

  constructor(private readonly provider: SupabaseProvider) {
    this.client = provider.client;
    this.table = provider.tables.records;
  }

  async list(params: RecordListParams): Promise<RecordListResult> {
    let query = this.client
      .from(this.table)
      .select("*", { count: "exact" })
      .eq("model_name", params.model);

    // Apply simple filters (key-value)
    if (params.filters) {
      for (const [field, value] of Object.entries(params.filters)) {
        if (value === undefined || value === null || value === "") continue;
        if (Array.isArray(value) && value.length === 0) continue;

        if (typeof value === "string") {
          query = query.ilike(`data->>${field}`, `%${value}%`);
        } else if (Array.isArray(value)) {
          query = query.contains(`data->${field}`, value);
        } else {
          query = query.eq(`data->>${field}`, value);
        }
      }
    }

    // Apply typed filters
    if (params.typedFilters) {
      for (const filter of params.typedFilters) {
        query = applyTypedFilter(query, filter);
      }
    }

    // Sorting
    if (params.sorter?.field) {
      const ascending = params.sorter.order !== "descend";
      query = query.order(`data->>${params.sorter.field}`, { ascending });
    } else {
      query = query.order("updated_at", { ascending: false });
    }

    // Pagination
    const current = params.pagination?.current ?? 1;
    const pageSize = params.pagination?.pageSize ?? 10;
    const start = (current - 1) * pageSize;
    const end = start + pageSize - 1;
    query = query.range(start, end);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    return {
      list: (data ?? []).map(toRecord),
      total: count ?? 0,
    };
  }

  async detail(params: RecordDetailParams): Promise<RecordDetailResult> {
    const { data, error } = await this.client
      .from(this.table)
      .select("*")
      .eq("id", params.id)
      .eq("model_name", params.model)
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Record not found: ${params.id}`);

    return toRecord(data);
  }

  async create(params: RecordCreateParams): Promise<RecordCreateResult> {
    const { data, error } = await this.client
      .from(this.table)
      .insert({
        model_name: params.model,
        data: params.values,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      success: true,
      data: toRecord(data),
    };
  }

  async update(params: RecordUpdateParams): Promise<RecordUpdateResult> {
    // First get existing data for merge
    const { data: existing, error: fetchError } = await this.client
      .from(this.table)
      .select("data")
      .eq("id", params.id)
      .eq("model_name", params.model)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    const mergedData = { ...existing.data, ...params.values };

    const { data, error } = await this.client
      .from(this.table)
      .update({
        data: mergedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("model_name", params.model)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      success: true,
      data: toRecord(data),
    };
  }

  async delete(params: RecordDeleteParams): Promise<RecordDeleteResult> {
    const { error } = await this.client
      .from(this.table)
      .delete()
      .eq("id", params.id)
      .eq("model_name", params.model);

    if (error) throw new Error(error.message);

    return { success: true };
  }

  async batchDelete(params: RecordBatchDeleteParams): Promise<RecordBatchDeleteResult> {
    const { error } = await this.client
      .from(this.table)
      .delete()
      .in("id", params.ids)
      .eq("model_name", params.model);

    if (error) throw new Error(error.message);

    return {
      success: true,
      data: { deleted: params.ids.length },
    };
  }
}
