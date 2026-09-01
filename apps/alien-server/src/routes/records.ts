import { Hono } from "hono";
import { getSchema } from "../db/schema-repo.ts";
import {
  createRecord,
  deleteRecord,
  deleteRecords,
  getRecord,
  listOptions,
  listRecords,
  listSubtree,
  updateRecord,
} from "../db/record-repo.ts";
import { expandRefs, expandRefsOne, unwrapRefs } from "../db/ref-expand.ts";
import type { Pagination, Sorter } from "../schema/types.ts";

export const recordRoutes = new Hono();

const USER_MODEL = "_sys_user";
const SENSITIVE_USER_FIELDS = new Set(["passwordHash"]);

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

/** POST /api/records/list → { list, total }（用 POST 承载复杂 filters/sorter）。 */
recordRoutes.post("/list", async (c) => {
  const body = (await c.req.json()) as ListBody;
  const schema = getSchema(body.model);
  if (!schema) return c.json({ error: `未知模型：${body.model}` }, 404);
  const result = listRecords(schema, {
    filters: unwrapRefs(body.filters),
    pagination: body.pagination,
    sorter: body.sorter,
  });
  // 引用字段展开为 { $ref, value, label }（批量 IN，每字段每页 1 查询）
  const expanded = expandRefs(schema, result.list);
  return c.json({
    ...result,
    list: expanded.map((record) => publicRecord(body.model, record)),
  });
});

/** POST /api/records/options → { options, total }。前 N 条搜索结果 + 已选值批量回显。 */
recordRoutes.post("/options", async (c) => {
  const body = (await c.req.json()) as OptionsBody;
  const schema = getSchema(body.model);
  if (!schema) return c.json({ error: `未知模型：${body.model}` }, 404);
  return c.json(
    listOptions(schema, {
      valueKey: body.valueKey ?? "id",
      labelKey: body.labelKey ?? body.valueKey ?? "id",
      keyword: body.keyword,
      selectedValues: body.selectedValues,
      limit: body.limit,
    }),
  );
});

/**
 * POST /api/records/subtree → { list }：树子树查询。
 * 传 idField/parentField/parentValue 时返回该节点下全部后代；不传 parentValue 返回整棵树。
 */
recordRoutes.post("/subtree", async (c) => {
  const body = (await c.req.json()) as {
    model: string;
    idField?: string;
    parentField?: string;
    parentValue?: string | null;
  };
  const schema = getSchema(body.model);
  if (!schema) return c.json({ error: `未知模型：${body.model}` }, 404);
  const list = listSubtree(schema, {
    idField: body.idField ?? "id",
    parentField: body.parentField ?? "id",
    parentValue: body.parentValue,
  });
  const expanded = expandRefs(schema, list);
  return c.json({ list: expanded.map((record) => publicRecord(body.model, record)) });
});

/** GET /api/records/:model/:id → ModelRecord。 */
recordRoutes.get("/:model/:id", (c) => {
  const { model, id } = c.req.param();
  const schema = getSchema(model);
  if (!schema) return c.json({ error: `未知模型：${model}` }, 404);
  const record = getRecord(schema, id);
  if (!record) return c.json({ error: `记录不存在：${id}` }, 404);
  return c.json(publicRecord(model, expandRefsOne(schema, record)));
});

/** POST /api/records/:model → 新建记录（幂等 upsert 支持传入 id）。 */
recordRoutes.post("/:model", async (c) => {
  const model = c.req.param("model");
  const schema = getSchema(model);
  if (!schema) return c.json({ error: `未知模型：${model}` }, 404);
  const values = (await c.req.json()) as Record<string, unknown>;
  const record = createRecord(schema, unwrapRefs(values)!);
  return c.json(publicRecord(model, expandRefsOne(schema, record)), 201);
});

/** PUT /api/records/:model/:id → 更新记录。 */
recordRoutes.put("/:model/:id", async (c) => {
  const { model, id } = c.req.param();
  const schema = getSchema(model);
  if (!schema) return c.json({ error: `未知模型：${model}` }, 404);
  const values = (await c.req.json()) as Record<string, unknown>;
  const record = updateRecord(schema, id, unwrapRefs(values)!);
  if (!record) return c.json({ error: `记录不存在：${id}` }, 404);
  return c.json(publicRecord(model, expandRefsOne(schema, record)));
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
