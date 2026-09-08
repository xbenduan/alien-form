import { Hono } from "hono";
import { loginRequestSchema } from "@alien-form/protocol";
import { bearerToken } from "../middleware/session.ts";
import { ok } from "../envelope.ts";
import { parseInput } from "../parse-input.ts";
import type { AppEnv } from "../../env.ts";

export const authRoutes = new Hono<AppEnv>();

/** POST /api/auth/login → { token, user, provider }。默认 provider=password。 */
authRoutes.post("/login", async (c) => {
  const value = await c.req.json().catch(() => ({}));
  const body = parseInput(() => loginRequestSchema.parse(value));
  return ok(c, await c.get("container").authService.login(body));
});

/** POST /api/auth/logout → 删除会话记录。 */
authRoutes.post("/logout", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { token?: string };
  const token = bearerToken(c.req.header("authorization")) ?? body.token;
  await c.get("container").authService.logout(token);
  return ok(c, null);
});
