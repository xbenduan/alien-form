import { Hono } from "hono";
import type { AppEnv } from "../../env.ts";
import { ok } from "../envelope.ts";

export const modelRoutes = new Hono<AppEnv>();

modelRoutes.get("/", async (c) => ok(c, await c.get("container").modelService.list()));

modelRoutes.get("/:name", async (c) =>
  ok(c, await c.get("container").modelService.get(c.req.param("name"))),
);

modelRoutes.post("/", async (c) => {
  const model = await c.get("container").modelService.create(await c.req.json());
  return ok(c, model, 201);
});

modelRoutes.put("/:name", async (c) =>
  ok(c, await c.get("container").modelService.update(c.req.param("name"), await c.req.json())),
);
