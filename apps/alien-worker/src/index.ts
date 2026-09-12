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

// 兜底路由。
//
// 注意：只把 GET/HEAD 转发给静态资源。把带 body 的请求（POST/PUT/…）转发给
// `ASSETS.fetch` 会让 workerd 抛出
// "Can't read from request stream after response has been sent"，
// 该异常不受 onError 保护，会直接打挂 wrangler dev 进程。
// 未匹配的 /api/* 也不应回落到 SPA，否则接口 404 会伪装成 200 HTML。
app.all("*", (c) => {
  if (c.req.path.startsWith("/api/")) {
    return fail(c, `No route for ${c.req.method} ${c.req.path}`, 404);
  }
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    return fail(c, `Method ${c.req.method} not allowed`, 405);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
