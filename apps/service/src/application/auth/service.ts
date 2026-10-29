import type { ActorSummary, CredentialEntry } from "formwork/model";
import type { Actor } from "../../contracts";
import { readPublished } from "../../adapters/d1/repositories/models";
import { decodeRow } from "../../adapters/d1/repositories/values";
import type { PhysicalRow } from "../../adapters/d1/repositories/values";
import { bindingExpression, quote } from "../../adapters/d1/compiler/storage";
import { forbidden, ServiceError } from "../../http/errors";
import { randomToken, tokenHash, verifyPassword } from "./password";
import { resolveActor } from "./access";

/** 返回 DTO 中的身份摘要，隐藏 credential 与角色解析细节。 */
export function actorSummary(actor: Actor): ActorSummary {
  const { credentialId: _credential, roleIds: _roles, ...summary } = actor;
  return summary;
}
/** 只按数据库 credential 解析身份类型，不接受 URL 或 header 身份声明。 */
export async function authenticate(db: D1Database, authorization?: string): Promise<Actor> {
  if (!authorization?.startsWith("Bearer "))
    throw new ServiceError("UNAUTHORIZED", "请先登录", 401);
  const hash = await tokenHash(authorization.slice(7));
  const credential = await db
    .prepare(
      `SELECT id, user_id, kind FROM fw_credentials
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
    )
    .bind(hash, new Date().toISOString())
    .first<{ id: string; user_id: string; kind: Actor["kind"] }>();
  if (!credential) throw new ServiceError("UNAUTHORIZED", "会话无效或已过期", 401);
  return resolveActor(db, credential.user_id, credential.kind, credential.id);
}
/** 签发可撤销 credential，明文仅返回一次。 */
export async function issueCredential(
  db: D1Database,
  userId: string,
  kind: Actor["kind"],
  label: string,
  days: number,
): Promise<CredentialEntry & { token: string }> {
  const token = randomToken();
  const entry: CredentialEntry = {
    id: crypto.randomUUID(),
    label,
    kind,
    revokedAt: null,
    expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
  };
  await db
    .prepare(
      "INSERT INTO fw_credentials(id, token_hash, user_id, kind, expires_at, label) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(entry.id, await tokenHash(token), userId, kind, entry.expiresAt, label)
    .run();
  return { ...entry, token };
}
/** 使用 DB 已发布用户定义定位账号，并沿用历史密码算法登录。 */
export async function login(db: D1Database, username: string, password: string) {
  const model = await readPublished(db, "system-users");
  const binding = model.definition.backend.storage.bindings.find(
    (item) => item.path === "/username",
  )!;
  const row = await db
    .prepare(`SELECT * FROM ${quote(model.manifest.table)} WHERE ${bindingExpression(binding)} = ?`)
    .bind(username.trim())
    .first<PhysicalRow>();
  if (!row || !password || !(await verifyPassword(password, decodeRow(model, row).passwordHash)))
    throw new ServiceError("UNAUTHORIZED", "账号或密码错误", 401);
  const credential = await issueCredential(db, row.id, "user", "浏览器会话", 7);
  const actor = await resolveActor(db, row.id, "user", credential.id);
  return { token: credential.token, user: actorSummary(actor) };
}
/** 阻止 agent/deploy 访问只允许真实浏览器会话执行的管理操作。 */
export function requireUser(actor: Actor): void {
  if (actor.kind !== "user") forbidden("此操作只允许 user session");
}
/** 拒绝 deploy credential 在能力清单之外的业务请求。 */
export function requireBusiness(actor: Actor): void {
  if (actor.kind === "deploy") forbidden("deploy credential 只允许登记能力清单");
}
/** 列出本人 credential 目录，不返回 token 摘要。 */
export async function listCredentials(db: D1Database, actor: Actor): Promise<CredentialEntry[]> {
  requireUser(actor);
  const rows = (
    await db
      .prepare(
        "SELECT id, label, kind, expires_at, revoked_at FROM fw_credentials WHERE user_id = ? ORDER BY expires_at DESC",
      )
      .bind(actor.id)
      .all<{
        id: string;
        label: string;
        kind: Actor["kind"];
        expires_at: string;
        revoked_at: string | null;
      }>()
  ).results;
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    kind: row.kind,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  }));
}
