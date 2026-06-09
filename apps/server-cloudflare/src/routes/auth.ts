import { Hono } from "hono";
import type { Env } from "../types";

const auth = new Hono<{ Bindings: Env }>();

async function signToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const data = encoder.encode(`${header}.${body}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `${header}.${body}.${signature}`;
}

auth.post("/login", async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>();

  if (username !== c.env.ADMIN_USERNAME || password !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await signToken(
    {
      sub: username,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    },
    c.env.JWT_SECRET
  );

  return c.json({ data: { token, expiresIn: 7 * 24 * 60 * 60 } });
});

auth.get("/me", (c) => {
  const user = c.get("user" as never);
  return c.json({ data: { username: user } });
});

export { auth };
