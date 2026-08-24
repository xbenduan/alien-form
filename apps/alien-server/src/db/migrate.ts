import { getDb } from "./connection.ts";
import { buildColumnDDL, buildTableDDL } from "../schema/ddl.ts";
import { builtinSchemas } from "../schemas/index.ts";
import { ensureSchemaTable, upsertSchema } from "./schema-repo.ts";
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

/**
 * 启动初始化：
 *  1. 建元表
 *  2. 内置模型：建物理表 + 注册 schema 到元表（幂等）
 *
 * 演示数据不再随启动写入，改由 `script/seed.js` 调用 HTTP 接口灌入。
 */
export function bootstrap(): void {
  ensureSchemaTable();

  // 先建所有物理表（顺序：role/user 先于 course，满足外键引用）。
  // 内置 schema 是代码里的唯一真相源，每次启动都覆盖注册到元表（保留首次 createdAt）。
  for (const schema of builtinSchemas) {
    migrateSchema(schema);
    upsertSchema(schema);
  }
}
