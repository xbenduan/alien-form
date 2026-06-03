import type { LogProvider, LogEntry, LogListParams } from "../log-provider";
import type { PaginatedResult } from "../../types/common";
import type { TcbClient } from "./tcb-client";

export class TcbLogProvider implements LogProvider {
  private readonly client: TcbClient;
  private readonly db: any;
  private readonly collection: string;

  constructor(client: TcbClient) {
    this.client = client;
    this.db = client.database();
    this.collection = client.collections.logs;
  }

  async append(entry: Omit<LogEntry, "id" | "timestamp">): Promise<LogEntry> {
    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    const doc = { _id: id, ...entry, timestamp };
    await this.db.collection(this.collection).add(doc);

    return { id, ...entry, timestamp };
  }

  async list(params?: LogListParams): Promise<PaginatedResult<LogEntry>> {
    const _ = this.db.command;
    const conditions: any[] = [];

    if (params?.modelName) {
      conditions.push({ modelName: _.eq(params.modelName) });
    }
    if (params?.action) {
      conditions.push({ action: _.eq(params.action) });
    }
    if (params?.dateRange) {
      conditions.push({
        timestamp: _.and(_.gte(params.dateRange.start), _.lte(params.dateRange.end)),
      });
    }

    const where = conditions.length > 0 ? _.and(conditions) : {};
    let query = this.db.collection(this.collection).where(where);

    const countResult = await query.count();
    const total = countResult.total;

    const current = params?.pagination?.current ?? 1;
    const pageSize = params?.pagination?.pageSize ?? 20;
    const skip = (current - 1) * pageSize;

    const { data } = await query
      .orderBy("timestamp", "desc")
      .skip(skip)
      .limit(pageSize)
      .get();

    const list: LogEntry[] = data.map((doc: any) => ({
      id: doc._id,
      action: doc.action,
      modelName: doc.modelName,
      recordId: doc.recordId,
      operator: doc.operator,
      summary: doc.summary,
      changes: doc.changes,
      timestamp: doc.timestamp,
    }));

    return { list, total };
  }
}
