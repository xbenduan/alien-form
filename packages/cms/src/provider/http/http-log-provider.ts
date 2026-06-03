import type { LogProvider, LogEntry, LogListParams } from "../log-provider";
import type { PaginatedResult } from "../../types/common";
import type { HttpClient } from "./http-client";

export class HttpLogProvider implements LogProvider {
  private readonly client: HttpClient;
  private readonly endpoint: string;

  constructor(
    client: HttpClient,
    endpoint?: string,
  ) {
    this.client = client;
    this.endpoint = endpoint ?? "/api/logs";
  }

  async append(entry: Omit<LogEntry, "id" | "timestamp">): Promise<LogEntry> {
    const response = await this.client.request<any>(this.endpoint, {
      method: "POST",
      body: entry,
    });

    const data = response?.data ?? response;
    return {
      id: data.id,
      action: data.action ?? entry.action,
      modelName: data.modelName ?? entry.modelName,
      recordId: data.recordId ?? entry.recordId,
      operator: data.operator ?? entry.operator,
      summary: data.summary ?? entry.summary,
      changes: data.changes ?? entry.changes,
      timestamp: data.timestamp ?? new Date().toISOString(),
    };
  }

  async list(params?: LogListParams): Promise<PaginatedResult<LogEntry>> {
    const queryParams = this.client.buildListParams({
      pagination: params?.pagination,
    });

    if (params?.modelName) {
      queryParams.modelName = params.modelName;
    }
    if (params?.action) {
      queryParams.action = params.action;
    }
    if (params?.dateRange) {
      queryParams.startDate = params.dateRange.start;
      queryParams.endDate = params.dateRange.end;
    }

    const response = await this.client.request<any>(this.endpoint, { params: queryParams });
    return this.client.extractList(response);
  }
}
