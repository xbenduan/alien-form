import { Hono } from "hono";
import type { AppEnv } from "../../env.ts";
import type { ListInput, OptionsInput, SubtreeInput } from "../../services/record-service.ts";

export const recordRoutes = new Hono<AppEnv>();

/** POST /api/records/list → { list, total }。 */
recordRoutes.post("/list", async (c) => {
  const body = (await c.req.json()) as ListInput;
  return c.json(await c.get("container").recordService.list(body));
});

/** POST /api/records/options → { options, total }。 */
recordRoutes.post("/options", async (c) => {
  const body = (await c.req.json()) as OptionsInput;
  return c.json(await c.get("container").recordService.options(body));
});

/** POST /api/records/subtree → { list }。 */
recordRoutes.post("/subtree", async (c) => {
  const body = (await c.req.json()) as SubtreeInput;
  return c.json(await c.get("container").recordService.subtree(body));
});

/** GET /api/records/:model/:id → ModelRecord。 */
recordRoutes.get("/:model/:id", async (c) => {
  const { model, id } = c.req.param();
  return c.json(await c.get("container").recordService.get(model, id));
});

/** POST /api/records/:model → 新建记录（幂等 upsert）。 */
recordRoutes.post("/:model", async (c) => {
  const values = (await c.req.json()) as Record<string, unknown>;
  const record = await c.get("container").recordService.create(c.req.param("model"), values);
  return c.json(record, 201);
});

/** PUT /api/records/:model/:id → 更新记录。 */
recordRoutes.put("/:model/:id", async (c) => {
  const { model, id } = c.req.param();
  const values = (await c.req.json()) as Record<string, unknown>;
  return c.json(await c.get("container").recordService.update(model, id, values));
});

/** POST /api/records/:model/batch-delete → 批量删除 { ids }。 */
recordRoutes.post("/:model/batch-delete", async (c) => {
  const { ids } = (await c.req.json()) as { ids: string[] };
  await c.get("container").recordService.removeMany(c.req.param("model"), ids);
  return c.body(null, 204);
});

/** DELETE /api/records/:model/:id → 删除单条（幂等）。 */
recordRoutes.delete("/:model/:id", async (c) => {
  const { model, id } = c.req.param();
  await c.get("container").recordService.remove(model, id);
  return c.body(null, 204);
});
