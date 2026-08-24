import { Hono } from "hono";
import { getSchema } from "../db/schema-repo.ts";
import {
  createRecord,
  deleteRecord,
  deleteRecords,
  getRecord,
  listRecords,
  updateRecord,
} from "../db/record-repo.ts";
import type { Pagination, Sorter } from "../schema/types.ts";

export const recordRoutes = new Hono();

const USER_MODEL = "school-user";
const SENSITIVE_USER_FIELDS = new Set(["passwordHash", "openid"]);

interface ListBody {
  model: string;
  filters?: Record<string, unknown>;
  pagination?: Pagination;
  sorter?: Sorter;
}

function publicRecord(model: string, record: Record<string, unknown>): Record<string, unknown> {
  if (model !== USER_MODEL) return record;
  const result = { ...record };
  for (const field of SENSITIVE_USER_FIELDS) delete result[field];
  return result;
}

/** POST /api/records/list → { list, total }（用 POST 承载复杂 filters/sorter）。 */
recordRoutes.post("/list", async (c) => {
  const body = (await c.req.json()) as ListBody;
  const schema = getSchema(body.model);
  if (!schema) return c.json({ error: `未知模型：${body.model}` }, 404);
  const result = listRecords(schema, {
    filters: body.filters,
    pagination: body.pagination,
    sorter: body.sorter,
  });
  return c.json({
    ...result,
    list: result.list.map((record) => publicRecord(body.model, record)),
  });
});

/** GET /api/records/:model/:id → ModelRecord。 */
recordRoutes.get("/:model/:id", (c) => {
  const { model, id } = c.req.param();
  const schema = getSchema(model);
  if (!schema) return c.json({ error: `未知模型：${model}` }, 404);
  const record = getRecord(schema, id);
  if (!record) return c.json({ error: `记录不存在：${id}` }, 404);
  return c.json(publicRecord(model, record));
});

/** POST /api/records/:model → 新建记录（幂等 upsert 支持传入 id）。 */
recordRoutes.post("/:model", async (c) => {
  const model = c.req.param("model");
  const schema = getSchema(model);
  if (!schema) return c.json({ error: `未知模型：${model}` }, 404);
  const values = (await c.req.json()) as Record<string, unknown>;
  const record = createRecord(schema, values);
  return c.json(publicRecord(model, record), 201);
});

/** PUT /api/records/:model/:id → 更新记录。 */
recordRoutes.put("/:model/:id", async (c) => {
  const { model, id } = c.req.param();
  const schema = getSchema(model);
  if (!schema) return c.json({ error: `未知模型：${model}` }, 404);
  const values = (await c.req.json()) as Record<string, unknown>;
  const record = updateRecord(schema, id, values);
  if (!record) return c.json({ error: `记录不存在：${id}` }, 404);
  return c.json(publicRecord(model, record));
});

/** POST /api/records/:model/batch-delete → 批量删除 { ids }。 */
recordRoutes.post("/:model/batch-delete", async (c) => {
  const model = c.req.param("model");
  const schema = getSchema(model);
  if (!schema) return c.json({ error: `未知模型：${model}` }, 404);
  const { ids } = (await c.req.json()) as { ids: string[] };
  deleteRecords(schema, ids ?? []);
  return c.body(null, 204);
});

/** DELETE /api/records/:model/:id → 删除单条（幂等）。 */
recordRoutes.delete("/:model/:id", (c) => {
  const { model, id } = c.req.param();
  const schema = getSchema(model);
  if (!schema) return c.json({ error: `未知模型：${model}` }, 404);
  deleteRecord(schema, id);
  return c.body(null, 204);
});
