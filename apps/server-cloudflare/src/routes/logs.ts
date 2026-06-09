import { Hono } from "hono";
import type { Env } from "../types";

const logs = new Hono<{ Bindings: Env }>();

function generateLogId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// GET /api/logs — list
logs.get("/", async (c) => {
  const current = parseInt(c.req.query("current") ?? "1");
  const pageSize = parseInt(c.req.query("pageSize") ?? "20");
  const modelName = c.req.query("modelName");
  const action = c.req.query("action");
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");
  const offset = (current - 1) * pageSize;

  const conditions: string[] = [];
  const params: any[] = [];

  if (modelName) {
    conditions.push("model_name = ?");
    params.push(modelName);
  }
  if (action) {
    conditions.push("action = ?");
    params.push(action);
  }
  if (startDate) {
    conditions.push("timestamp >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("timestamp <= ?");
    params.push(endDate);
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

  const db = c.env.DB;
  const [countResult, listResult] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as total FROM cms_logs${where}`).bind(...params).first<{ total: number }>(),
    db.prepare(
      `SELECT * FROM cms_logs${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    ).bind(...params, pageSize, offset).all(),
  ]);

  const list = (listResult.results ?? []).map((row: any) => ({
    id: row.id,
    action: row.action,
    modelName: row.model_name,
    recordId: row.record_id,
    operator: row.operator,
    summary: row.summary,
    changes: row.changes_json ? JSON.parse(row.changes_json) : undefined,
    timestamp: row.timestamp,
  }));

  return c.json({ data: { list, total: countResult?.total ?? 0 } });
});

// POST /api/logs — append
logs.post("/", async (c) => {
  const body = await c.req.json<{
    action: string;
    modelName: string;
    recordId?: string;
    operator?: string;
    summary?: string;
    changes?: unknown;
  }>();

  const id = generateLogId();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "INSERT INTO cms_logs (id, action, model_name, record_id, operator, summary, changes_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    id,
    body.action,
    body.modelName,
    body.recordId ?? null,
    body.operator ?? null,
    body.summary ?? null,
    body.changes ? JSON.stringify(body.changes) : null,
    now
  ).run();

  return c.json({
    data: {
      id,
      action: body.action,
      modelName: body.modelName,
      recordId: body.recordId,
      operator: body.operator,
      summary: body.summary,
      changes: body.changes,
      timestamp: now,
    },
  });
});

export { logs };
