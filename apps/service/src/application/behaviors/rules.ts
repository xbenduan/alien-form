import type { RecordValue } from "formwork/model";
import type { Actor, StoredModel } from "../../contracts";
import { readPublished } from "../../adapters/d1/repositories/models";
import { readRow, withRelations } from "../../adapters/d1/repositories/values";
import type { PhysicalRow } from "../../adapters/d1/repositories/values";
import { quote, bindingExpression } from "../../adapters/d1/compiler/storage";
import { forbidden, invalid } from "../../http/errors";
import { hashPassword } from "../auth/password";

/** 执行可信系统规则，密码明文不会进入存储或 outbox。 */
export async function prepareAndValidate(
  db: D1Database,
  model: StoredModel,
  actor: Actor,
  operation: "create" | "update" | "delete",
  record: RecordValue,
  previous?: RecordValue,
): Promise<RecordValue> {
  const rules = model.definition.backend.behavior.rules;
  const identities = new Map(
    (
      await db
        .prepare("SELECT name, record_id FROM fw_system_identities")
        .all<{ name: string; record_id: string }>()
    ).results.map((row) => [row.name, row.record_id]),
  );
  if (rules.includes("system.password") && operation !== "delete") {
    if (typeof record.password === "string" && record.password)
      record.passwordHash = await hashPassword(record.password);
    delete record.password;
    if (!record.passwordHash) invalid("新用户必须设置密码");
  }
  if (rules.includes("system.users")) {
    const admin = identities.get("bootstrap"),
      superRole = identities.get("super-role");
    if (record.id === admin) {
      if (operation === "delete") forbidden("初始化管理员不可删除");
      if (previous && record.username !== previous.username) forbidden("初始化管理员账号不可修改");
      record.roleId = [superRole!];
    } else if (Array.isArray(record.roleId) && record.roleId.includes(superRole!)) {
      forbidden("可信超级角色仅可由初始化管理员持有");
    }
    if (operation !== "delete") {
      if (!Array.isArray(record.roleId) || !record.roleId.length) invalid("用户必须关联有效角色");
      record.roleId = [...new Set(record.roleId)];
    }
  }
  if (rules.includes("system.roles")) {
    const superRole = identities.get("super-role");
    if (record.id === superRole) forbidden("可信超级角色不可修改或删除");
    if (record.code === "super_admin") forbidden("超级角色标识仅可由系统初始化");
    if (operation === "delete") {
      const parent = model.definition.backend.storage.bindings.find(
        (binding) => binding.path === "/parentId",
      )!;
      if (
        await db
          .prepare(
            `SELECT 1 FROM ${quote(model.manifest.table)} WHERE ${bindingExpression(parent)} = ?`,
          )
          .bind(record.id)
          .first()
      )
        forbidden("存在子角色，无法删除");
      const users = await readPublished(db, "system-users");
      const roleField = users.definition.backend.storage.bindings.find(
        (binding) => binding.path === "/roleId",
      );
      const relation = users.manifest.relations.find(
        (item) => item.active && item.fieldId === roleField?.id,
      );
      if (
        relation?.table &&
        (await db
          .prepare(`SELECT 1 FROM ${quote(relation.table)} WHERE target_value = ?`)
          .bind(record.id)
          .first())
      )
        forbidden("存在关联用户，无法删除");
    } else {
      if (typeof record.parentId !== "string" || !record.parentId)
        invalid("非根角色必须选择父级角色");
      const visited = new Set<string>([String(record.id)]);
      let id: string | undefined = record.parentId;
      while (id) {
        if (visited.has(id)) invalid("角色父级形成循环");
        visited.add(id);
        const row = await readRow(db, model, id);
        if (!row) invalid("父级角色不存在");
        const parent = await withRelations(db, model, row);
        id = typeof parent.parentId === "string" ? parent.parentId : undefined;
      }
    }
  }
  if (rules.includes("system.categories")) {
    const marker = [...identities].find(
      ([name, id]) => name.startsWith("category:") && id === record.id,
    );
    if (marker) {
      if (operation === "delete") forbidden("系统预置分类不可删除");
      if (previous && record.code !== previous.code) forbidden("预置分类标识不可修改");
      if (record.aggregate !== (marker[0] === "category:all"))
        forbidden("预置分类聚合属性不可修改");
    }
  }
  // Check every user's referenced role, including the protected administrator.
  if (rules.includes("system.users") && operation !== "delete") {
    const roles = await readPublished(db, "system-roles");
    for (const id of record.roleId as string[])
      if (!(await readRow(db, roles, id))) invalid("用户关联了不存在的角色");
  }
  // Any non-admin may only reach this rule through explicit current grants.
  void actor;
  return record;
}
/** 为防环和引用保护准备事务内断言，消除并发检查与写入之间的空隙。 */
export async function systemAssertions(
  db: D1Database,
  model: StoredModel,
  operation: "create" | "update" | "delete",
  record: RecordValue,
): Promise<{ sql: string; values: (string | number | null)[] }[]> {
  const result: { sql: string; values: (string | number | null)[] }[] = [];
  if (model.definition.backend.behavior.rules.includes("system.roles")) {
    const parent = model.definition.backend.storage.bindings.find(
      (binding) => binding.path === "/parentId",
    )!;
    if (operation !== "delete")
      result.push({
        sql: `NOT EXISTS(WITH RECURSIVE ancestors(id, parent_id) AS (
        SELECT id, ${bindingExpression(parent)} FROM ${quote(model.manifest.table)} WHERE id = ?
        UNION SELECT r.id, r.${quote(parent.column!)} FROM ${quote(model.manifest.table)} r
        JOIN ancestors a ON r.id = a.parent_id) SELECT 1 FROM ancestors WHERE id = ?)`,
        values: [String(record.parentId), String(record.id)],
      });
    else
      result.push({
        sql: `NOT EXISTS(SELECT 1 FROM ${quote(model.manifest.table)} WHERE ${bindingExpression(parent)} = ?)`,
        values: [String(record.id)],
      });
  }
  return result;
}
/** 检查真实存量关系，用于迁移和系统规则的记录核对。 */
export async function rawRecords(db: D1Database, model: StoredModel): Promise<RecordValue[]> {
  const rows = (await db.prepare(`SELECT * FROM ${quote(model.manifest.table)}`).all<PhysicalRow>())
    .results;
  const records: RecordValue[] = [];
  for (const row of rows) records.push(await withRelations(db, model, row));
  return records;
}
