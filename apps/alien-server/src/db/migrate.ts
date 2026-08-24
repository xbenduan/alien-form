import { getDb } from "./connection.ts";
import { buildTableDDL } from "../schema/ddl.ts";
import { builtinSchemas } from "../schemas/index.ts";
import { ensureSchemaTable, upsertSchema } from "./schema-repo.ts";
import type { ModelSchema } from "../schema/types.ts";

/** 执行一份 schema 的建表 DDL（幂等，IF NOT EXISTS）。 */
export function migrateSchema(schema: ModelSchema): void {
  const db = getDb();
  for (const stmt of buildTableDDL(schema)) db.exec(stmt);
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
