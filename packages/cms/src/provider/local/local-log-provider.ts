import type { LogProvider, LogEntry, LogListParams } from "../log-provider";
import type { PaginatedResult } from "../../types/common";

const MAX_LOGS = 500;
declare global {
  var __alienCmsLocalLogs__: LogEntry[] | undefined;
}

function getStore() {
  if (!globalThis.__alienCmsLocalLogs__) {
    globalThis.__alienCmsLocalLogs__ = [];
  }
  return globalThis.__alienCmsLocalLogs__;
}

/**
 * Local in-memory LogProvider for demo/offline mode.
 * Stores up to 500 most recent log entries for the current session only.
 */
export class LocalLogProvider implements LogProvider {
  async append(entry: Omit<LogEntry, "id" | "timestamp">): Promise<LogEntry> {
    const logs = getStore();
    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    const logEntry: LogEntry = { id, ...entry, timestamp };
    logs.unshift(logEntry); // newest first
    if (logs.length > MAX_LOGS) {
      logs.length = MAX_LOGS;
    }

    return logEntry;
  }

  async list(params?: LogListParams): Promise<PaginatedResult<LogEntry>> {
    let logs = [...getStore()];

    if (params?.modelName) {
      logs = logs.filter((l) => l.modelName === params.modelName);
    }
    if (params?.action) {
      logs = logs.filter((l) => l.action === params.action);
    }
    if (params?.dateRange) {
      logs = logs.filter(
        (l) => l.timestamp >= params.dateRange!.start && l.timestamp <= params.dateRange!.end
      );
    }

    // Already sorted newest-first from append
    const total = logs.length;
    const current = params?.pagination?.current ?? 1;
    const pageSize = params?.pagination?.pageSize ?? 20;
    const start = (current - 1) * pageSize;

    return {
      list: logs.slice(start, start + pageSize),
      total,
    };
  }
}
