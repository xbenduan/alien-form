import { getDb } from "./connection.ts";
import { buildColumnDDL, buildTableDDL } from "../schema/ddl.ts";
import { builtinSchemas } from "../schemas/index.ts";
import {
  SYS_ADMIN_ID,
  SYS_ADMIN_NICKNAME,
  SYS_ADMIN_USERNAME,
  SYS_ADMIN_DEFAULT_PASSWORD,
} from "../schemas/_sys_user.ts";
import { ensureSchemaTable, upsertSchema } from "./schema-repo.ts";
import { createRecord, findRecordByField, getRecord } from "./record-repo.ts";
import { hashPassword } from "../routes/auth.ts";
import { planFields } from "../schema/field-plan.ts";
import { tableName } from "../schema/naming.ts";
import type { ModelSchema } from "../schema/types.ts";

/** 执行一份 schema 的建表 DDL（幂等，IF NOT EXISTS）。 */
export function migrateSchema(schema: ModelSchema): void {
  const db = getDb();
  const [createTable, ...rest] = buildTableDDL(schema);
  db.exec(createTable);
  syncMissingColumns(schema);
  for (const stmt of rest) db.exec(stmt);
}

/** 内置 schema 演进时，为既有表补齐新增的普通列。 */
function syncMissingColumns(schema: ModelSchema): void {
  const db = getDb();
  const table = tableName(schema.meta.name);
  const rows = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
  const existing = new Set(rows.map((row) => row.name));

  for (const plan of planFields(schema)) {
    if (plan.kind !== "column" || existing.has(plan.column)) continue;
    db.exec(`ALTER TABLE "${table}" ADD COLUMN ${buildColumnDDL(plan)}`);
  }
}

/** 写入默认系统管理员（幂等）：账号 _sys_admin，密码 alien123456，创建者为自身。 */
function ensureSysAdmin(): void {
  const schema = builtinSchemas.find((item) => item.meta.name === "_sys_user");
  if (!schema) return;
  if (
    getRecord(schema, SYS_ADMIN_ID) ||
    findRecordByField(schema, "username", SYS_ADMIN_USERNAME)
  ) {
    return;
  }
  createRecord(schema, {
    id: SYS_ADMIN_ID,
    username: SYS_ADMIN_USERNAME,
    nickname: SYS_ADMIN_NICKNAME,
    passwordHash: hashPassword(SYS_ADMIN_DEFAULT_PASSWORD),
    createBy: SYS_ADMIN_ID,
    remark: "系统内置管理员（首次启动自动创建）。",
  });
}

/**
 * 启动初始化：
 *  1. 建元表
 *  2. 内置模型：建物理表 + 注册 schema 到元表（幂等）
 *  3. 写入默认系统管理员
 */
export function bootstrap(): void {
  ensureSchemaTable();

  for (const schema of builtinSchemas) {
    migrateSchema(schema);
    upsertSchema(schema);
  }

  ensureSysAdmin();
}
