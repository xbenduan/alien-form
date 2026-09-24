import { AppError } from "@alien-form/alienbase";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { fail, ok } from "./envelope.ts";
import type { AppEnv } from "./env.ts";
import { useCore } from "./middleware/core.ts";
import { requireSession } from "./middleware/session.ts";
import { authRoutes } from "./routes/auth.ts";
import { modelRoutes } from "./routes/models.ts";
import { recordRoutes } from "./routes/records.ts";

const API_PREFIX = "/api/v1";

/** 创建无请求级全局状态的 Hono 应用。 */
export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use(`${API_PREFIX}/*`, useCore);
  app.use(
    `${API_PREFIX}/*`,
    cors({ origin: "*", allowHeaders: ["Authorization", "Content-Type"] }),
  );

  app.get(`${API_PREFIX}/health`, (c) => ok(c, { ok: true }));
  app.route(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/models`, requireSession);
  app.use(`${API_PREFIX}/models/*`, requireSession);
  app.use(`${API_PREFIX}/records`, requireSession);
  app.use(`${API_PREFIX}/records/*`, requireSession);
  app.route(`${API_PREFIX}/models`, modelRoutes);
  app.route(`${API_PREFIX}/records`, recordRoutes);

  app.onError((error, c) => {
    if (error instanceof AppError) return fail(c, error.message, error.status as 400);
    console.error(
      JSON.stringify({
        message: "unhandled request error",
        path: c.req.path,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return fail(c, "Internal server error", 500);
  });

  app.all("*", (c) => {
    if (c.req.path.startsWith("/api/")) {
      return fail(c, `No route for ${c.req.method} ${c.req.path}`, 404);
    }
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      return fail(c, `Method ${c.req.method} not allowed`, 405);
    }
    return c.env.ASSETS.fetch(c.req.raw);
  });

  return app;
}
