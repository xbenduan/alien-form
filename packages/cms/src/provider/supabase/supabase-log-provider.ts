import type { LogProvider, LogEntry, LogListParams } from "../log-provider";
import type { PaginatedResult } from "../../types/common";
import type { SupabaseProvider } from "./supabase-client";

export class SupabaseLogProvider implements LogProvider {
  private readonly provider: SupabaseProvider;
  private readonly client: any;
  private readonly table: string;

  constructor(provider: SupabaseProvider) {
    this.provider = provider;
    this.client = provider.client;
    this.table = provider.tables.logs;
  }

  async append(entry: Omit<LogEntry, "id" | "timestamp">): Promise<LogEntry> {
    const { data, error } = await this.client
      .from(this.table)
      .insert({
        action: entry.action,
        model_name: entry.modelName,
        record_id: entry.recordId ?? null,
        operator: entry.operator ?? null,
        summary: entry.summary ?? null,
        changes: entry.changes ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      action: data.action,
      modelName: data.model_name,
      recordId: data.record_id,
      operator: data.operator,
      summary: data.summary,
      changes: data.changes,
      timestamp: data.created_at,
    };
  }

  async list(params?: LogListParams): Promise<PaginatedResult<LogEntry>> {
    let query = this.client
      .from(this.table)
      .select("*", { count: "exact" });

    if (params?.modelName) {
      query = query.eq("model_name", params.modelName);
    }
    if (params?.action) {
      query = query.eq("action", params.action);
    }
    if (params?.dateRange) {
      query = query.gte("created_at", params.dateRange.start).lte("created_at", params.dateRange.end);
    }

    query = query.order("created_at", { ascending: false });

    const current = params?.pagination?.current ?? 1;
    const pageSize = params?.pagination?.pageSize ?? 20;
    const start = (current - 1) * pageSize;
    const end = start + pageSize - 1;
    query = query.range(start, end);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    const list: LogEntry[] = (data ?? []).map((row: any) => ({
      id: row.id,
      action: row.action,
      modelName: row.model_name,
      recordId: row.record_id,
      operator: row.operator,
      summary: row.summary,
      changes: row.changes,
      timestamp: row.created_at,
    }));

    return { list, total: count ?? 0 };
  }
}
