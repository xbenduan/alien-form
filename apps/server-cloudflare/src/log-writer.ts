/**
 * Internal log writer utility.
 * Used by routes to automatically append audit logs after mutations.
 * The front-end no longer needs to call POST /api/logs directly.
 */

export interface LogWriteParams {
  action: string;
  modelName: string;
  recordId?: string;
  operator?: string;
  summary?: string;
  changes?: unknown;
}

function generateLogId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Append a log entry to the cms_logs table.
 * This is fire-and-forget: errors are caught and logged to console,
 * so logging failures don't break the main mutation response.
 */
export async function appendLog(db: D1Database, params: LogWriteParams): Promise<void> {
  try {
    const id = generateLogId();
    const now = new Date().toISOString();

    await db.prepare(
      "INSERT INTO cms_logs (id, action, model_name, record_id, operator, summary, changes_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      id,
      params.action,
      params.modelName,
      params.recordId ?? null,
      params.operator ?? null,
      params.summary ?? null,
      params.changes ? JSON.stringify(params.changes) : null,
      now,
    ).run();
  } catch (err) {
    console.error("[log-writer] Failed to write log:", err);
  }
}
