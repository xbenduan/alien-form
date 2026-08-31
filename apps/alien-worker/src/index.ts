import { Hono } from "hono";
import { cors } from "hono/cors";
import { ensureBootstrapped } from "./db/bootstrap.ts";
import { schemaRoutes } from "./routes/schemas.ts";
import { recordRoutes } from "./routes/records.ts";
import { authRoutes, requireSession, type AuthContext } from "./routes/auth.ts";
import type { Env } from "./env.ts";

const app = new Hono<{ Bindings: Env; Variables: AuthContext }>();

// 每个 /api 请求前确保内置 schema 已登记（幂等，missing 才写）。
app.use("/api/*", async (c, next) => {
  await ensureBootstrapped(c.env.DB);
  await next();
});

// 允许跨域（同源部署时可选，独立域名调试时需要）。
app.use("/api/*", cors({ origin: "*", allowHeaders: ["Authorization", "Content-Type"] }));

// 开发期人为延时（与 Node 版对齐；production 或 API_DELAY=false 关闭）。
app.use("/api/*", async (c, next) => {
  const enabled = c.env.ENVIRONMENT !== "production" && c.env.API_DELAY !== "false";
  if (enabled) {
    const delay = 100 + Math.floor(Math.random() * 401);
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }
  await next();
});

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/auth", authRoutes);
app.use("/api/schemas", requireSession);
app.use("/api/schemas/*", requireSession);
app.use("/api/records", requireSession);
app.use("/api/records/*", requireSession);
app.route("/api/schemas", schemaRoutes);
app.route("/api/records", recordRoutes);

// 统一错误兜底：DB / 校验错误转 400，避免 500 泄漏栈。
app.onError((err, c) => {
  console.error("[alien-worker] error:", err);
  const message = err instanceof Error ? err.message : String(err);
  return c.json({ error: message }, 400);
});

// 非 /api 请求交给静态资源（SPA fallback 由 wrangler assets 的 single-page-application 处理）。
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
