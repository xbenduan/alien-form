import { Hono } from "hono";
import {
  getSchemaEntry,
  hasSchema,
  listSchemas as listSchemaEntries,
  removeSchema,
  upsertSchema,
} from "../db/schema-repo.ts";
import { migrateSchema } from "../db/migrate.ts";
import type { ModelSchema } from "../schema/types.ts";

export const schemaRoutes = new Hono();

/** GET /api/schemas → ModelSummary[]（落地页 / 列表）。 */
schemaRoutes.get("/", (c) => {
  const summaries = listSchemaEntries().map(({ schema, updatedAt }) => ({
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
schemaRoutes.get("/:name", (c) => {
  const entry = getSchemaEntry(c.req.param("name"));
  if (!entry) return c.json({ error: `模型不存在：${c.req.param("name")}` }, 404);
  return c.json(entry.schema);
});

/** POST /api/schemas → 新建模型（同名报错），建表 + 注册。 */
schemaRoutes.post("/", async (c) => {
  const schema = (await c.req.json()) as ModelSchema;
  if (hasSchema(schema.meta.name)) {
    return c.json({ error: `模型已存在：${schema.meta.name}` }, 409);
  }
  migrateSchema(schema);
  const entry = upsertSchema(schema);
  return c.json(entry.schema, 201);
});

/** PUT /api/schemas/:name → 更新模型（保持 name），建表补齐新增列/表。 */
schemaRoutes.put("/:name", async (c) => {
  const name = c.req.param("name");
  if (!hasSchema(name)) return c.json({ error: `模型不存在：${name}` }, 404);
  const incoming = (await c.req.json()) as ModelSchema;
  const schema: ModelSchema = { ...incoming, meta: { ...incoming.meta, name } };
  migrateSchema(schema);
  const entry = upsertSchema(schema);
  return c.json(entry.schema);
});

/** DELETE /api/schemas/:name → 删除模型（元表移除，物理表保留，demo 从简）。 */
schemaRoutes.delete("/:name", (c) => {
  removeSchema(c.req.param("name"));
  return c.body(null, 204);
});
