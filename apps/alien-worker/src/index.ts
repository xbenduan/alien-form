import { Hono } from "hono";
import { cors } from "hono/cors";
import { Container } from "./container.ts";
import { ensureBootstrapped } from "./bootstrap.ts";
import { AppError } from "./errors.ts";
import { ok, fail } from "./http/envelope.ts";
import { requireSession } from "./http/middleware/session.ts";
import { modelRoutes } from "./http/routes/models.ts";
import { recordRoutes } from "./http/routes/records.ts";
import { authRoutes } from "./http/routes/auth.ts";
import type { AppEnv } from "./env.ts";

const app = new Hono<AppEnv>();

// 每个 /api 请求：装配依赖容器 → 挂到 context → 确保内置状态存在（幂等）。
app.use("/api/v1/*", async (c, next) => {
  const container = new Container(c.env.DB);
  c.set("container", container);
  await ensureBootstrapped(container);
  await next();
});

// 允许跨域（同源部署时可选，独立域名调试时需要）。
app.use("/api/v1/*", cors({ origin: "*", allowHeaders: ["Authorization", "Content-Type"] }));

app.get("/api/v1/health", (c) => ok(c, { ok: true }));
app.route("/api/v1/auth", authRoutes);
app.use("/api/v1/models", requireSession);
app.use("/api/v1/models/*", requireSession);
app.use("/api/v1/records", requireSession);
app.use("/api/v1/records/*", requireSession);
app.route("/api/v1/models", modelRoutes);
app.route("/api/v1/records", recordRoutes);

app.onError((err, c) => {
  if (err instanceof AppError) return fail(c, err.message, err.status as 400);
  console.error(
    JSON.stringify({
      message: "unhandled request error",
      path: c.req.path,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  return fail(c, "Internal server error", 500);
});

// 非 /api 请求交给静态资源（SPA fallback 由 wrangler assets 的 single-page-application 处理）。
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
