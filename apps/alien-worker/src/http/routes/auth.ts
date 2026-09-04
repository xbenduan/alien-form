import { Hono } from "hono";
import { bearerToken } from "../middleware/session.ts";
import type { AppEnv } from "../../env.ts";
import type { LoginBody } from "../../services/auth/auth-service.ts";

export const authRoutes = new Hono<AppEnv>();

/** POST /api/auth/login → { token, user, provider }。默认 provider=password。 */
authRoutes.post("/login", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as LoginBody;
  return c.json(await c.get("container").authService.login(body));
});

/** POST /api/auth/logout → 204。删除会话记录。 */
authRoutes.post("/logout", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { token?: string };
  const token = bearerToken(c.req.header("authorization")) ?? body.token;
  await c.get("container").authService.logout(token);
  return c.body(null, 204);
});
