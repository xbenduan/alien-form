import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bootstrap } from "./db/migrate.ts";
import { schemaRoutes } from "./routes/schemas.ts";
import { recordRoutes } from "./routes/records.ts";
import { authRoutes } from "./routes/auth.ts";

// 启动即建表 + 注册内置 schema（幂等）。演示数据用 `node script/seed.js` 灌入。
bootstrap();

const app = new Hono();

// 允许前端 dev 跨域（vite 也会代理 /api，这里双保险）
app.use("/api/*", cors());

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/auth", authRoutes);
app.route("/api/schemas", schemaRoutes);
app.route("/api/records", recordRoutes);

// 统一错误兜底：唯一约束等 DB 错误转成 400，避免 500 泄漏栈
app.onError((err, c) => {
  console.error("[alien-server] error:", err);
  const message = err instanceof Error ? err.message : String(err);
  return c.json({ error: message }, 400);
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[alien-server] listening on http://localhost:${info.port}`);
});
