import { Hono } from "hono";
import type { Env } from "../types";

const health = new Hono<{ Bindings: Env }>();

health.get("/", async (c) => {
  const start = Date.now();
  try {
    await c.env.DB.prepare("SELECT 1").first();
    return c.json({
      ok: true,
      provider: "cloudflare-d1",
      latency: Date.now() - start,
      message: "Connected.",
      capabilities: { schemas: true, records: true, logs: true },
    });
  } catch (e: any) {
    return c.json({
      ok: false,
      provider: "cloudflare-d1",
      latency: Date.now() - start,
      message: e.message ?? "D1 connection failed",
    }, 500);
  }
});

export { health };
