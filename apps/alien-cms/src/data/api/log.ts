import { getLogProvider } from "../internal/provider";
import type { LogEntry, LogListParams } from "../provider/log-provider";

export function listLogs(params?: LogListParams) {
  return getLogProvider().list(params);
}

export function appendLog(entry: Omit<LogEntry, "id" | "timestamp">) {
  return getLogProvider().append(entry);
}
