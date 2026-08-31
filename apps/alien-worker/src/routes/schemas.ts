import { Hono } from "hono";
import {
  getSchemaEntry,
  hasSchema,
  listSchemas as listSchemaEntries,
  removeSchema,
  upsertSchema,
} from "../db/schemas.ts";
import type { ModelSchema } from "../../../alien-server/src/schema/types.ts";
import type { Env } from "../env.ts";

export const schemaRoutes = new Hono<{ Bindings: Env }>();

/** GET /api/schemas → ModelSummary[]。 */
schemaRoutes.get("/", async (c) => {
  const entries = await listSchemaEntries(c.env.DB);
  const summaries = entries.map(({ schema, updatedAt }) => ({
    name: schema.meta.name,
    title: schema.meta.title,
    subtitle: schema.meta.subtitle,
    description: schema.meta.description,
    group: schema.meta.group,
    fieldCount: Object.keys(schema.properties ?? {}).length,
    updatedAt,
  }));
  return c.json(summaries);
});

/** GET /api/schemas/:name → ModelSchema。 */
schemaRoutes.get("/:name", async (c) => {
  const entry = await getSchemaEntry(c.env.DB, c.req.param("name"));
  if (!entry) return c.json({ error: `模型不存在：${c.req.param("name")}` }, 404);
  return c.json(entry.schema);
});

/** POST /api/schemas → 新建模型（同名报错）。通用表存储，无需建表 DDL。 */
schemaRoutes.post("/", async (c) => {
  const schema = (await c.req.json()) as ModelSchema;
  if (await hasSchema(c.env.DB, schema.meta.name)) {
    return c.json({ error: `模型已存在：${schema.meta.name}` }, 409);
  }
  const entry = await upsertSchema(c.env.DB, schema);
  return c.json(entry.schema, 201);
});

/** PUT /api/schemas/:name → 更新模型（保持 name）。 */
schemaRoutes.put("/:name", async (c) => {
  const name = c.req.param("name");
  if (!(await hasSchema(c.env.DB, name))) return c.json({ error: `模型不存在：${name}` }, 404);
  const incoming = (await c.req.json()) as ModelSchema;
  const schema: ModelSchema = { ...incoming, meta: { ...incoming.meta, name } };
  const entry = await upsertSchema(c.env.DB, schema);
  return c.json(entry.schema);
});

/** DELETE /api/schemas/:name → 删除模型（元表移除，记录保留，demo 从简）。 */
schemaRoutes.delete("/:name", async (c) => {
  await removeSchema(c.env.DB, c.req.param("name"));
  return c.body(null, 204);
});
