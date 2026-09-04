import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../../env.ts";

function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}

export { bearerToken };

/** 会话中间件：token → 会话查库，挂到 context.session。找不到即 401。 */
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const token = bearerToken(c.req.header("authorization"));
  if (!token) return c.json({ error: "未登录或会话已失效" }, 401);
  const session = await c.get("container").authService.resolveSession(token);
  if (!session) return c.json({ error: "未登录或会话已失效" }, 401);
  c.set("session", session);
  await next();
});
