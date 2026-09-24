import { Hono } from "hono";
import type { AppEnv } from "../env.ts";
import { ok } from "../envelope.ts";

export const modelRoutes = new Hono<AppEnv>();

modelRoutes.get("/", async (c) => ok(c, await c.get("core").models.list(c.get("session").userId)));

modelRoutes.get("/:name", async (c) =>
  ok(c, await c.get("core").models.get(c.req.param("name"), c.get("session").userId)),
);

modelRoutes.post("/", async (c) => {
  const model = await c.get("core").models.create(await c.req.json(), c.get("session").userId);
  return ok(c, model, 201);
});

modelRoutes.put("/:name", async (c) =>
  ok(
    c,
    await c
      .get("core")
      .models.update(c.req.param("name"), await c.req.json(), c.get("session").userId),
  ),
);

modelRoutes.delete("/:name", async (c) => {
  await c.get("core").models.remove(c.req.param("name"), c.get("session").userId);
  return ok(c, null);
});
