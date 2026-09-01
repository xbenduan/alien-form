import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { findRecordByField, updateRecord } from "../db/records.ts";
import { getSchema } from "../db/schemas.ts";
import type { ModelRecord, ModelSchema } from "../../../alien-server/src/schema/types.ts";
import type { Env } from "../env.ts";

const USER_MODEL = "school-user";
const PASSWORD_ALGORITHM = "pbkdf2_sha256";
// Cloudflare Workers 的 WebCrypto PBKDF2 迭代上限为 100000，超过会直接抛错，
// 故这里固定 100000（Node 版可用更高值，两端 seed 需与运行端对齐）。
const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_KEY_LENGTH = 32; // bytes
const PASSWORD_HASH = "SHA-256";

export interface Session {
  token: string;
  userId: string;
  provider: string;
  createdAt: number;
  userType?: string;
  roleIds: string[];
}

export interface AuthContext {
  session: Session;
}

type Bindings = { Bindings: Env; Variables: AuthContext };

export const authRoutes = new Hono<Bindings>();

interface LoginBody {
  provider?: string;
  username?: string;
  account?: string;
  password?: string;
  openid?: string;
}

function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}

function toHex(buffer: ArrayBufferLike): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 把字符串编码为独立的 ArrayBuffer。
 * 新版 TS 里 Uint8Array 泛型化为 Uint8Array<ArrayBufferLike>，无法直接满足 WebCrypto
 * 参数要求的具体 ArrayBuffer；这里拷贝到新分配的 ArrayBuffer，规避类型不兼容。
 */
function encodeUtf8(text: string): ArrayBuffer {
  const view = new TextEncoder().encode(text);
  const buffer = new ArrayBuffer(view.byteLength);
  new Uint8Array(buffer).set(view);
  return buffer;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function randomHex(byteLength: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(byteLength)).buffer);
}

async function pbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encodeUtf8(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encodeUtf8(salt),
      iterations,
      hash: PASSWORD_HASH,
    },
    key,
    PASSWORD_KEY_LENGTH * 8,
  );
  return toHex(bits);
}

/** 生成新密码哈希：pbkdf2_sha256$iterations$salt$hash（与 Node 版 / seed 同构）。 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomHex(16);
  const hash = await pbkdf2(password, salt, PASSWORD_ITERATIONS);
  return `${PASSWORD_ALGORITHM}$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

/** 常数时间比较，避免时序侧信道。 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyPassword(password: string, stored: unknown): Promise<boolean> {
  if (typeof stored !== "string" || !stored) return false;
  const [algorithm, iterations, salt, hash] = stored.split("$");
  const iterationCount = Number(iterations);
  // 迭代数从存储值动态解析；但 Workers 上限 100000，超过无法校验直接判负。
  if (
    algorithm !== PASSWORD_ALGORITHM ||
    !Number.isInteger(iterationCount) ||
    iterationCount < 1 ||
    iterationCount > 100_000 ||
    !salt ||
    !hash
  ) {
    return false;
  }
  const actual = hexToBytes(await pbkdf2(password, salt, iterationCount));
  const expected = hexToBytes(hash);
  return timingSafeEqual(actual, expected);
}

function publicUser(user: ModelRecord): ModelRecord {
  const { passwordHash: _passwordHash, openid: _openid, ...safeUser } = user;
  return safeUser;
}

/** 会话中间件：token → sessions 表查会话，挂到 context。 */
export const requireSession = createMiddleware<Bindings>(async (c, next) => {
  const token = bearerToken(c.req.header("authorization"));
  if (!token) return c.json({ error: "未登录或会话已失效" }, 401);
  const row = await c.env.DB.prepare(
    `SELECT token, user_id, provider, user_type, role_ids, created_at FROM "sessions" WHERE token = ?`,
  )
    .bind(token)
    .first<{
      token: string;
      user_id: string;
      provider: string;
      user_type: string | null;
      role_ids: string;
      created_at: number;
    }>();
  if (!row) return c.json({ error: "未登录或会话已失效" }, 401);
  c.set("session", {
    token: row.token,
    userId: row.user_id,
    provider: row.provider,
    createdAt: row.created_at,
    userType: row.user_type ?? undefined,
    roleIds: safeParseArray(row.role_ids),
  });
  await next();
});

function safeParseArray(text: string): string[] {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

async function authenticatePassword(
  db: D1Database,
  schema: ModelSchema,
  body: LoginBody,
): Promise<ModelRecord | undefined> {
  const username = String(body.username ?? body.account ?? "").trim();
  const password = String(body.password ?? "");
  if (!username || !password) return undefined;
  const user = await findRecordByField(db, schema, "username", username);
  if (!user || user.status !== "active") return undefined;
  return (await verifyPassword(password, user.passwordHash)) ? user : undefined;
}

/** POST /api/auth/login → { token, user }。默认 provider=password。 */
authRoutes.post("/login", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as LoginBody;
  const providerName = body.provider ?? "password";
  if (providerName !== "password") {
    return c.json({ error: `不支持的登录方式：${providerName}` }, 400);
  }

  const userSchema = await getSchema(c.env.DB, USER_MODEL);
  if (!userSchema) return c.json({ error: "用户模型未注册" }, 500);

  const user = await authenticatePassword(c.env.DB, userSchema, body);
  if (!user) return c.json({ error: "账号或密码错误" }, 401);

  const token = randomHex(32);
  const roleIds = Array.isArray(user.roleIds)
    ? user.roleIds.filter((roleId): roleId is string => typeof roleId === "string")
    : [];
  await c.env.DB.prepare(
    `INSERT INTO "sessions" (token, user_id, provider, user_type, role_ids, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      token,
      user.id,
      "password",
      typeof user.userType === "string" ? user.userType : null,
      JSON.stringify(roleIds),
      Date.now(),
    )
    .run();

  const latestUser =
    (await updateRecord(c.env.DB, userSchema, user.id, {
      lastLoginAt: new Date().toISOString(),
    })) ?? user;
  return c.json({ token, user: publicUser(latestUser), provider: "password" });
});

/** POST /api/auth/logout → 204。删除会话记录。 */
authRoutes.post("/logout", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { token?: string };
  const token = bearerToken(c.req.header("authorization")) ?? body.token;
  if (token) await c.env.DB.prepare(`DELETE FROM "sessions" WHERE token = ?`).bind(token).run();
  return c.body(null, 204);
});
