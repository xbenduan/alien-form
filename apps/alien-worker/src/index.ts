import { Hono } from "hono";
import { cors } from "hono/cors";
import { Container } from "./container.ts";
import { ensureBootstrapped } from "./bootstrap.ts";
import { AppError } from "./errors.ts";
import { requireSession } from "./http/middleware/session.ts";
import { schemaRoutes } from "./http/routes/schemas.ts";
import { recordRoutes } from "./http/routes/records.ts";
import { authRoutes } from "./http/routes/auth.ts";
import type { AppEnv } from "./env.ts";

const app = new Hono<AppEnv>();

// 每个 /api 请求：装配依赖容器 → 挂到 context → 确保内置状态存在（幂等）。
app.use("/api/*", async (c, next) => {
  const container = new Container(c.env.DB);
  c.set("container", container);
  await ensureBootstrapped(container);
  await next();
});

// 允许跨域（同源部署时可选，独立域名调试时需要）。
app.use("/api/*", cors({ origin: "*", allowHeaders: ["Authorization", "Content-Type"] }));

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/auth", authRoutes);
app.use("/api/schemas", requireSession);
app.use("/api/schemas/*", requireSession);
app.use("/api/records", requireSession);
app.use("/api/records/*", requireSession);
app.route("/api/schemas", schemaRoutes);
app.route("/api/records", recordRoutes);

// 统一错误兜底：AppError 用自带状态码，其余 DB / 校验错误转 400，避免 500 泄漏栈。
app.onError((err, c) => {
  const status = err instanceof AppError ? err.status : 400;
  if (!(err instanceof AppError)) console.error("[alien-worker] error:", err);
  const message = err instanceof Error ? err.message : String(err);
  return c.json({ error: message }, status as 400);
});

// 非 /api 请求交给静态资源（SPA fallback 由 wrangler assets 的 single-page-application 处理）。
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
