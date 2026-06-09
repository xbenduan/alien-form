import { Hono } from "hono";
import type { Env } from "../types";
import { loadSchema, validateRecord } from "../validate";
import { appendLog } from "../log-writer";

const records = new Hono<{ Bindings: Env }>();

function generateId(model: string): string {
  return `${model}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Whitelist check for identifiers used in dynamic SQL to prevent injection */
function isSafeIdentifier(str: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str);
}

// GET /api/records — list
records.get("/", async (c) => {
  const model = c.req.query("model");
  if (!model) {
    return c.json({ error: "model query param required" }, 400);
  }

  const current = parseInt(c.req.query("current") ?? "1");
  const pageSize = Math.min(Math.max(parseInt(c.req.query("pageSize") ?? "10"), 1), 100);
  const sortField = c.req.query("sortField");
  const sortOrder = c.req.query("sortOrder");
  const offset = (current - 1) * pageSize;

  // Build filter conditions from remaining query params
  const reservedKeys = new Set(["model", "current", "pageSize", "sortField", "sortOrder"]);
  const filters: Array<{ key: string; value: string }> = [];
  for (const [key, value] of Object.entries(c.req.queries() ?? {})) {
    if (!reservedKeys.has(key) && value?.[0]) {
      if (isSafeIdentifier(key)) {
        filters.push({ key, value: value[0] });
      }
    }
  }

  const db = c.env.DB;

  // Count query
  let countSql = "SELECT COUNT(*) as total FROM cms_records WHERE model_name = ?";
  const countParams: any[] = [model];

  // List query
  let listSql = "SELECT id, data_json, created_at, updated_at FROM cms_records WHERE model_name = ?";
  const listParams: any[] = [model];

  // Apply JSON filters using json_extract (keys already validated as safe identifiers)
  for (const f of filters) {
    const condition = ` AND json_extract(data_json, '$.${f.key}') LIKE ?`;
    countSql += condition;
    listSql += condition;
    countParams.push(`%${f.value}%`);
    listParams.push(`%${f.value}%`);
  }

  // Sort — validate sortField to prevent injection
  if (sortField && sortField !== "updatedAt" && sortField !== "createdAt") {
    if (isSafeIdentifier(sortField)) {
      const order = sortOrder === "desc" ? "DESC" : "ASC";
      listSql += ` ORDER BY json_extract(data_json, '$.${sortField}') ${order}`;
    } else {
      listSql += " ORDER BY updated_at DESC";
    }
  } else {
    const field = sortField === "createdAt" ? "created_at" : "updated_at";
    const order = sortOrder === "asc" ? "ASC" : "DESC";
    listSql += ` ORDER BY ${field} ${order}`;
  }

  listSql += " LIMIT ? OFFSET ?";
  listParams.push(pageSize, offset);

  const [countResult, listResult] = await Promise.all([
    db.prepare(countSql).bind(...countParams).first<{ total: number }>(),
    db.prepare(listSql).bind(...listParams).all(),
  ]);

  const list = (listResult.results ?? []).map((row: any) => {
    const data = JSON.parse(row.data_json);
    return {
      id: row.id,
      ...data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  return c.json({ data: { list, total: countResult?.total ?? 0 } });
});

// POST /api/records/batch-delete (must be before /:id)
records.post("/batch-delete", async (c) => {
  const { model, ids } = await c.req.json<{ model: string; ids: string[] }>();

  if (!model || !ids?.length) {
    return c.json({ error: "model and ids required" }, 400);
  }

  if (ids.length > 100) {
    return c.json({ error: "Cannot batch delete more than 100 records at once" }, 400);
  }

  const placeholders = ids.map(() => "?").join(",");
  await c.env.DB.prepare(
    `DELETE FROM cms_records WHERE model_name = ? AND id IN (${placeholders})`
  ).bind(model, ...ids).run();

  // Auto log
  const operator = c.get("user" as never) as string | undefined;
  await appendLog(c.env.DB, {
    action: "record.batchDelete",
    modelName: model,
    operator,
    summary: `批量删除 ${ids.length} 条记录`,
    changes: { ids },
  });

  return c.json({ data: { success: true, data: { deleted: ids.length } } });
});

// GET /api/records/:id — detail
records.get("/:id", async (c) => {
  const id = c.req.param("id");
  const model = c.req.query("model");

  let sql = "SELECT id, data_json, created_at, updated_at FROM cms_records WHERE id = ?";
  const params: any[] = [id];
  if (model) {
    sql += " AND model_name = ?";
    params.push(model);
  }

  const row = await c.env.DB.prepare(sql).bind(...params).first<any>();

  if (!row) {
    return c.json({ error: "Record not found" }, 404);
  }

  const data = JSON.parse(row.data_json);
  return c.json({ data: { id: row.id, ...data, createdAt: row.created_at, updatedAt: row.updated_at } });
});

// POST /api/records — create
records.post("/", async (c) => {
  const body = await c.req.json<{ model: string; values: Record<string, unknown> }>();
  const { model, values } = body;

  if (!model) {
    return c.json({ error: "model required" }, 400);
  }

  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return c.json({ error: "values must be a non-null object" }, 400);
  }

  // Load schema and validate
  const schema = await loadSchema(c.env.DB, model);
  if (!schema) {
    return c.json({ error: `Schema "${model}" not found` }, 404);
  }

  const errors = validateRecord(schema, values, { partial: false });
  if (errors.length > 0) {
    return c.json({ error: "Validation failed", details: errors }, 422);
  }

  const id = generateId(model);
  const now = Date.now();

  await c.env.DB.prepare(
    "INSERT INTO cms_records (id, model_name, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, model, JSON.stringify(values), now, now).run();

  // Auto log
  const operator = c.get("user" as never) as string | undefined;
  await appendLog(c.env.DB, {
    action: "record.create",
    modelName: model,
    recordId: id,
    operator,
    summary: `创建记录 ${id}`,
    changes: { values },
  });

  return c.json({
    data: { success: true, data: { id, ...values, createdAt: now, updatedAt: now } },
  });
});

// PUT /api/records/:id — update
records.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ model: string; values: Record<string, unknown> }>();
  const { model, values } = body;

  if (!model) {
    return c.json({ error: "model required" }, 400);
  }

  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return c.json({ error: "values must be a non-null object" }, 400);
  }

  const now = Date.now();

  // Merge with existing data
  const existing = await c.env.DB.prepare(
    "SELECT data_json FROM cms_records WHERE id = ? AND model_name = ?"
  ).bind(id, model).first<{ data_json: string }>();

  if (!existing) {
    return c.json({ error: "Record not found" }, 404);
  }

  const existingData = JSON.parse(existing.data_json);
  const merged = { ...existingData, ...values };

  // Load schema and validate the merged result
  const schema = await loadSchema(c.env.DB, model);
  if (schema) {
    const errors = validateRecord(schema, merged, { partial: false });
    if (errors.length > 0) {
      return c.json({ error: "Validation failed", details: errors }, 422);
    }
  }

  await c.env.DB.prepare(
    "UPDATE cms_records SET data_json = ?, updated_at = ? WHERE id = ? AND model_name = ?"
  ).bind(JSON.stringify(merged), now, id, model).run();

  // Auto log — compute diff
  const changedKeys = Object.keys(values).filter(
    (key) => JSON.stringify(existingData[key]) !== JSON.stringify(values[key]),
  );
  const operator = c.get("user" as never) as string | undefined;
  await appendLog(c.env.DB, {
    action: "record.update",
    modelName: model,
    recordId: id,
    operator,
    summary: `更新记录 ${id}，变更字段: ${changedKeys.join(", ") || "(无变更)"}`,
    changes: { before: existingData, after: merged, changedKeys },
  });

  return c.json({
    data: { success: true, data: { id, ...merged, updatedAt: now } },
  });
});

// DELETE /api/records/:id
records.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const model = c.req.query("model");

  if (!model) {
    return c.json({ error: "model query param required" }, 400);
  }

  const result = await c.env.DB.prepare(
    "DELETE FROM cms_records WHERE id = ? AND model_name = ?"
  ).bind(id, model).run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Record not found" }, 404);
  }

  // Auto log
  const operator = c.get("user" as never) as string | undefined;
  await appendLog(c.env.DB, {
    action: "record.delete",
    modelName: model,
    recordId: id,
    operator,
    summary: `删除记录 ${id}`,
  });

  return c.json({ data: { success: true } });
});

export { records };
