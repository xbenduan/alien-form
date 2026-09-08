import { Hono } from "hono";
import {
  batchDeleteRequestSchema,
  listRequestSchema,
  optionsRequestSchema,
  recordValuesSchema,
  subtreeRequestSchema,
} from "@alien-form/protocol";
import type { AppEnv } from "../../env.ts";
import { ok } from "../envelope.ts";
import { parseInput } from "../parse-input.ts";

export const recordRoutes = new Hono<AppEnv>();

/** POST /api/records/list → { list, total }。 */
recordRoutes.post("/list", async (c) => {
  const value = await c.req.json();
  const body = parseInput(() => listRequestSchema.parse(value));
  return ok(c, await c.get("container").recordService.list(body, c.get("session").userId));
});

/** POST /api/records/options → { options, total }。 */
recordRoutes.post("/options", async (c) => {
  const value = await c.req.json();
  const body = parseInput(() => optionsRequestSchema.parse(value));
  return ok(c, await c.get("container").recordService.options(body));
});

/** POST /api/records/subtree → { list }。 */
recordRoutes.post("/subtree", async (c) => {
  const value = await c.req.json();
  const body = parseInput(() => subtreeRequestSchema.parse(value));
  return ok(c, await c.get("container").recordService.subtree(body));
});

/** GET /api/records/:model/:id → ModelRecord。 */
recordRoutes.get("/:model/:id", async (c) => {
  const { model, id } = c.req.param();
  return ok(c, await c.get("container").recordService.get(model, id));
});

/** POST /api/records/:model → 新建记录（幂等 upsert）。 */
recordRoutes.post("/:model", async (c) => {
  const value = await c.req.json();
  const values = parseInput(() => recordValuesSchema.parse(value));
  const record = await c
    .get("container")
    .recordService.create(c.req.param("model"), values, c.get("session").userId);
  return ok(c, record, 201);
});

/** PUT /api/records/:model/:id → 更新记录。 */
recordRoutes.put("/:model/:id", async (c) => {
  const { model, id } = c.req.param();
  const value = await c.req.json();
  const values = parseInput(() => recordValuesSchema.parse(value));
  return ok(
    c,
    await c.get("container").recordService.update(model, id, values, c.get("session").userId),
  );
});

/** POST /api/records/:model/batch-delete → 批量删除 { ids }。 */
recordRoutes.post("/:model/batch-delete", async (c) => {
  const value = await c.req.json();
  const { ids } = parseInput(() => batchDeleteRequestSchema.parse(value));
  await c
    .get("container")
    .recordService.removeMany(c.req.param("model"), ids, c.get("session").userId);
  return ok(c, null);
});

/** DELETE /api/records/:model/:id → 删除单条（幂等）。 */
recordRoutes.delete("/:model/:id", async (c) => {
  const { model, id } = c.req.param();
  await c.get("container").recordService.remove(model, id, c.get("session").userId);
  return ok(c, null);
});
