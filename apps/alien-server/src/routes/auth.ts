import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { findRecordByField } from "../db/record-repo.ts";
import { getSchema } from "../db/schema-repo.ts";
import type { ModelRecord, ModelSchema } from "../schema/types.ts";

const USER_MODEL = "_sys_user";
const PASSWORD_ALGORITHM = "pbkdf2_sha256";
const PASSWORD_ITERATIONS = 120_000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";

export const authRoutes = new Hono<{ Variables: AuthContext }>();

interface LoginBody {
  provider?: string;
  username?: string;
  account?: string;
  password?: string;
  openid?: string;
}

export interface Session {
  token: string;
  userId: string;
  provider: string;
  createdAt: number;
}

export interface AuthContext {
  session: Session;
}

interface AuthProvider {
  name: string;
  authenticate(schema: ModelSchema, body: LoginBody): ModelRecord | undefined;
}

const sessions = new Map<string, Session>();

export const requireSession = createMiddleware<{ Variables: AuthContext }>(
  async (c, next) => {
    const token = bearerToken(c.req.header("authorization"));
    const session = token ? sessions.get(token) : undefined;
    if (!session) return c.json({ error: "未登录或会话已失效" }, 401);
    c.set("session", session);
    await next();
  },
);

function publicUser(user: ModelRecord): ModelRecord {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function hashPasswordWithSalt(password: string, salt: string): string {
  return pbkdf2Sync(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST,
  ).toString("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${PASSWORD_ALGORITHM}$${PASSWORD_ITERATIONS}$${salt}$${hashPasswordWithSalt(password, salt)}`;
}

function verifyPassword(password: string, stored: unknown): boolean {
  if (typeof stored !== "string" || !stored) return false;
  const [algorithm, iterations, salt, hash] = stored.split("$");
  if (
    algorithm !== PASSWORD_ALGORITHM ||
    iterations !== String(PASSWORD_ITERATIONS) ||
    !salt ||
    !hash
  ) {
    return false;
  }
  const actual = Buffer.from(hashPasswordWithSalt(password, salt), "hex");
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const passwordProvider: AuthProvider = {
  name: "password",
  authenticate(schema, body) {
    const username = String(body.username ?? body.account ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !password) return undefined;
    const user = findRecordByField(schema, "username", username);
    if (!user) return undefined;
    return verifyPassword(password, user.passwordHash) ? user : undefined;
  },
};

const authProviders = new Map<string, AuthProvider>([[passwordProvider.name, passwordProvider]]);

function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}

/** POST /api/auth/login → { token, user }。默认 provider=password，后续可注册 openid provider。 */
authRoutes.post("/login", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as LoginBody;
  const providerName = body.provider ?? "password";
  const provider = authProviders.get(providerName);
  if (!provider) return c.json({ error: `不支持的登录方式：${providerName}` }, 400);

  const userSchema = getSchema(USER_MODEL);
  if (!userSchema) return c.json({ error: "用户模型未注册" }, 500);

  const user = provider.authenticate(userSchema, body);
  if (!user) return c.json({ error: "账号或密码错误" }, 401);

  const token = randomBytes(32).toString("base64url");
  sessions.set(token, {
    token,
    userId: user.id,
    provider: provider.name,
    createdAt: Date.now(),
  });
  return c.json({ token, user: publicUser(user), provider: provider.name });
});

/** POST /api/auth/logout → 204。当前实现为服务端内存 session，前端同时清本地 token。 */
authRoutes.post("/logout", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { token?: string };
  const token = bearerToken(c.req.header("authorization")) ?? body.token;
  if (token) sessions.delete(token);
  return c.body(null, 204);
});
