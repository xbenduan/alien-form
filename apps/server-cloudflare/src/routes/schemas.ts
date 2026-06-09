import { Hono } from "hono";
import type { Env } from "../types";

const schemas = new Hono<{ Bindings: Env }>();

// GET /api/schemas — list
schemas.get("/", async (c) => {
  const current = parseInt(c.req.query("current") ?? "1");
  const pageSize = parseInt(c.req.query("pageSize") ?? "20");
  const keyword = c.req.query("keyword") ?? "";
  const offset = (current - 1) * pageSize;

  let countSql = "SELECT COUNT(*) as total FROM cms_schemas";
  let listSql = "SELECT model_name, title, description, created_at, updated_at FROM cms_schemas";
  const params: string[] = [];

  if (keyword) {
    const where = " WHERE model_name LIKE ?1 OR title LIKE ?1 OR description LIKE ?1";
    countSql += where;
    listSql += where;
    params.push(`%${keyword}%`);
  }

  listSql += " ORDER BY updated_at DESC LIMIT ?2 OFFSET ?3";

  const db = c.env.DB;
  const [countResult, listResult] = await Promise.all([
    db.prepare(countSql).bind(...params).first<{ total: number }>(),
    db.prepare(listSql).bind(...params, pageSize, offset).all(),
  ]);

  const list = (listResult.results ?? []).map((row: any) => ({
    name: row.model_name,
    title: row.title ?? row.model_name,
    description: row.description ?? "",
    source: "remote" as const,
    updatedAt: row.updated_at,
  }));

  return c.json({ data: { list, total: countResult?.total ?? 0 } });
});

// GET /api/schemas/:modelName — detail
schemas.get("/:modelName", async (c) => {
  const modelName = c.req.param("modelName");
  const row = await c.env.DB.prepare(
    "SELECT schema_json FROM cms_schemas WHERE model_name = ?"
  ).bind(modelName).first<{ schema_json: string }>();

  if (!row) {
    return c.json({ error: "Schema not found" }, 404);
  }

  return c.json({ data: JSON.parse(row.schema_json) });
});

// POST /api/schemas — create
schemas.post("/", async (c) => {
  const { schema } = await c.req.json<{ schema: any }>();
  const modelName = schema?.["x-model"]?.name;

  if (!modelName) {
    return c.json({ error: "Schema must have x-model.name" }, 400);
  }

  const title = schema?.["x-model"]?.title ?? modelName;
  const description = schema?.["x-model"]?.description ?? "";
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "INSERT INTO cms_schemas (model_name, schema_json, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(modelName, JSON.stringify(schema), title, description, now, now).run();

  return c.json({
    data: { success: true, data: { name: modelName, title, description, source: "remote", updatedAt: now } },
  });
});

// PUT /api/schemas/:modelName — update
schemas.put("/:modelName", async (c) => {
  const modelName = c.req.param("modelName");
  const { schema } = await c.req.json<{ schema: any }>();

  const title = schema?.["x-model"]?.title ?? modelName;
  const description = schema?.["x-model"]?.description ?? "";
  const now = new Date().toISOString();

  const result = await c.env.DB.prepare(
    "UPDATE cms_schemas SET schema_json = ?, title = ?, description = ?, updated_at = ? WHERE model_name = ?"
  ).bind(JSON.stringify(schema), title, description, now, modelName).run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Schema not found" }, 404);
  }

  return c.json({
    data: { success: true, data: { name: modelName, title, description, source: "remote", updatedAt: now } },
  });
});

// DELETE /api/schemas/:modelName
schemas.delete("/:modelName", async (c) => {
  const modelName = c.req.param("modelName");

  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM cms_schemas WHERE model_name = ?").bind(modelName),
    c.env.DB.prepare("DELETE FROM cms_records WHERE model_name = ?").bind(modelName),
    c.env.DB.prepare("DELETE FROM cms_logs WHERE model_name = ?").bind(modelName),
  ]);

  return c.json({ data: { success: true } });
});

export { schemas };
