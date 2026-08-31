import { Hono } from "hono";
import { getSchema } from "../db/schemas.ts";
import {
  createRecord,
  deleteRecord,
  deleteRecords,
  getRecord,
  listOptions,
  listRecords,
  listSubtree,
  updateRecord,
} from "../db/records.ts";
import { expandRefs, expandRefsOne, unwrapRefs } from "../db/ref-expand.ts";
import type { Pagination, Sorter } from "../../../alien-server/src/schema/types.ts";
import type { Env } from "../env.ts";

export const recordRoutes = new Hono<{ Bindings: Env }>();

const USER_MODEL = "school-user";
const SENSITIVE_USER_FIELDS = new Set(["passwordHash", "openid"]);

interface ListBody {
  model: string;
  filters?: Record<string, unknown>;
  pagination?: Pagination;
  sorter?: Sorter;
}

interface OptionsBody {
  model: string;
  valueKey?: string;
  labelKey?: string;
  keyword?: string;
  selectedValues?: unknown[];
  limit?: number;
}

function publicRecord(model: string, record: Record<string, unknown>): Record<string, unknown> {
  if (model !== USER_MODEL) return record;
  const result = { ...record };
  for (const field of SENSITIVE_USER_FIELDS) delete result[field];
  return result;
}

/** POST /api/records/list → { list, total }。 */
recordRoutes.post("/list", async (c) => {
  const body = (await c.req.json()) as ListBody;
  const schema = await getSchema(c.env.DB, body.model);
  if (!schema) return c.json({ error: `未知模型：${body.model}` }, 404);
  const result = await listRecords(c.env.DB, schema, {
    filters: unwrapRefs(body.filters),
    pagination: body.pagination,
    sorter: body.sorter,
  });
  const expanded = await expandRefs(c.env.DB, schema, result.list);
  return c.json({
    ...result,
    list: expanded.map((record) => publicRecord(body.model, record)),
  });
});

/** POST /api/records/options → { options, total }。 */
recordRoutes.post("/options", async (c) => {
  const body = (await c.req.json()) as OptionsBody;
  const schema = await getSchema(c.env.DB, body.model);
  if (!schema) return c.json({ error: `未知模型：${body.model}` }, 404);
  return c.json(
    await listOptions(c.env.DB, schema, {
      valueKey: body.valueKey ?? "id",
      labelKey: body.labelKey ?? body.valueKey ?? "id",
      keyword: body.keyword,
      selectedValues: body.selectedValues,
      limit: body.limit,
    }),
  );
});

/** POST /api/records/subtree → { list }。 */
recordRoutes.post("/subtree", async (c) => {
  const body = (await c.req.json()) as {
    model: string;
    idField?: string;
    parentField?: string;
    parentValue?: string | null;
  };
  const schema = await getSchema(c.env.DB, body.model);
  if (!schema) return c.json({ error: `未知模型：${body.model}` }, 404);
  const list = await listSubtree(c.env.DB, schema, {
    idField: body.idField ?? "id",
    parentField: body.parentField ?? "id",
    parentValue: body.parentValue,
  });
  const expanded = await expandRefs(c.env.DB, schema, list);
  return c.json({ list: expanded.map((record) => publicRecord(body.model, record)) });
});

/** GET /api/records/:model/:id → ModelRecord。 */
recordRoutes.get("/:model/:id", async (c) => {
  const { model, id } = c.req.param();
  const schema = await getSchema(c.env.DB, model);
  if (!schema) return c.json({ error: `未知模型：${model}` }, 404);
  const record = await getRecord(c.env.DB, schema, id);
  if (!record) return c.json({ error: `记录不存在：${id}` }, 404);
  return c.json(publicRecord(model, await expandRefsOne(c.env.DB, schema, record)));
});

/** POST /api/records/:model → 新建记录（幂等 upsert）。 */
recordRoutes.post("/:model", async (c) => {
  const model = c.req.param("model");
  const schema = await getSchema(c.env.DB, model);
  if (!schema) return c.json({ error: `未知模型：${model}` }, 404);
  const values = (await c.req.json()) as Record<string, unknown>;
  const record = await createRecord(c.env.DB, schema, unwrapRefs(values)!);
  return c.json(publicRecord(model, await expandRefsOne(c.env.DB, schema, record)), 201);
});

/** PUT /api/records/:model/:id → 更新记录。 */
recordRoutes.put("/:model/:id", async (c) => {
  const { model, id } = c.req.param();
  const schema = await getSchema(c.env.DB, model);
  if (!schema) return c.json({ error: `未知模型：${model}` }, 404);
  const values = (await c.req.json()) as Record<string, unknown>;
  const record = await updateRecord(c.env.DB, schema, id, unwrapRefs(values)!);
  if (!record) return c.json({ error: `记录不存在：${id}` }, 404);
  return c.json(publicRecord(model, await expandRefsOne(c.env.DB, schema, record)));
});

/** POST /api/records/:model/batch-delete → 批量删除 { ids }。 */
recordRoutes.post("/:model/batch-delete", async (c) => {
  const model = c.req.param("model");
  const schema = await getSchema(c.env.DB, model);
  if (!schema) return c.json({ error: `未知模型：${model}` }, 404);
  const { ids } = (await c.req.json()) as { ids: string[] };
  await deleteRecords(c.env.DB, schema, ids ?? []);
  return c.body(null, 204);
});

/** DELETE /api/records/:model/:id → 删除单条（幂等）。 */
recordRoutes.delete("/:model/:id", async (c) => {
  const { model, id } = c.req.param();
  const schema = await getSchema(c.env.DB, model);
  if (!schema) return c.json({ error: `未知模型：${model}` }, 404);
  await deleteRecord(c.env.DB, schema, id);
  return c.body(null, 204);
});
