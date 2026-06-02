import type { LogProvider, LogEntry, LogListParams } from "../log-provider";
import type { PaginatedResult } from "../../types/common";

const STORAGE_KEY = "alien-cms:local-logs";
const MAX_LOGS = 500;

function readStore(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStore(logs: LogEntry[]): void {
  // Keep only the most recent MAX_LOGS entries
  const trimmed = logs.slice(0, MAX_LOGS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

/**
 * Local (localStorage-based) LogProvider for demo/offline mode.
 * Stores up to 500 most recent log entries.
 */
export class LocalLogProvider implements LogProvider {
  async append(entry: Omit<LogEntry, "id" | "timestamp">): Promise<LogEntry> {
    const logs = readStore();
    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    const logEntry: LogEntry = { id, ...entry, timestamp };
    logs.unshift(logEntry); // newest first
    writeStore(logs);

    return logEntry;
  }

  async list(params?: LogListParams): Promise<PaginatedResult<LogEntry>> {
    let logs = readStore();

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
