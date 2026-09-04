import { Hono } from "hono";
import type { BuilderSchema as ModelSchema } from "@alien-form/validate";
import type { AppEnv } from "../../env.ts";

export const schemaRoutes = new Hono<AppEnv>();

/** GET /api/schemas → ModelSummary[]。 */
schemaRoutes.get("/", async (c) => {
  return c.json(await c.get("container").schemaService.list());
});

/** GET /api/schemas/:name → ModelSchema。 */
schemaRoutes.get("/:name", async (c) => {
  return c.json(await c.get("container").schemaService.get(c.req.param("name")));
});

/** POST /api/schemas → 新建模型（同名报错）。 */
schemaRoutes.post("/", async (c) => {
  const schema = (await c.req.json()) as ModelSchema;
  const entry = await c.get("container").schemaService.create(schema);
  return c.json(entry.schema, 201);
});

/** PUT /api/schemas/:name → 更新模型（保持 name）。 */
schemaRoutes.put("/:name", async (c) => {
  const incoming = (await c.req.json()) as ModelSchema;
  const entry = await c.get("container").schemaService.update(c.req.param("name"), incoming);
  return c.json(entry.schema);
});

/** DELETE /api/schemas/:name → 删除模型（记录保留，demo 从简）。 */
schemaRoutes.delete("/:name", async (c) => {
  await c.get("container").schemaService.remove(c.req.param("name"));
  return c.body(null, 204);
});
