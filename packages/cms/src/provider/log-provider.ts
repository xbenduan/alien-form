import type { Pagination, PaginatedResult } from "../types/common";

// ─── Log Entry Types ─────────────────────────────────────────

export type LogAction =
  | "schema.create"
  | "schema.update"
  | "schema.delete"
  | "record.create"
  | "record.update"
  | "record.delete"
  | "record.batchDelete";

export interface LogEntry {
  id: string;
  action: LogAction;
  modelName: string;
  recordId?: string;
  operator?: string;
  summary?: string;
  changes?: unknown;
  timestamp: string;
}

// ─── Log Query Params ────────────────────────────────────────

export interface LogListParams {
  modelName?: string;
  action?: LogAction;
  pagination?: Pagination;
  dateRange?: { start: string; end: string };
}

// ─── Log Provider Interface ──────────────────────────────────

/**
 * Interface for audit log operations.
 * Implementations: LocalLogProvider (IndexedDB), TcbLogProvider, SupabaseLogProvider, HttpLogProvider.
 */
export interface LogProvider {
  /** Append a log entry. */
  append(entry: Omit<LogEntry, "id" | "timestamp">): Promise<LogEntry>;

  /** List log entries with optional filters and pagination. */
  list(params?: LogListParams): Promise<PaginatedResult<LogEntry>>;
}
