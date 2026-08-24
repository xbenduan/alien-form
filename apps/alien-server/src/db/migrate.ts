import { getDb } from "./connection.ts";
import { buildTableDDL } from "../schema/ddl.ts";
import { builtinSchemas } from "../schemas/index.ts";
import { ensureSchemaTable, upsertSchema } from "./schema-repo.ts";
import { countRecords, createRecord } from "./record-repo.ts";
import { createSeedRecords } from "./seeds.ts";
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
 *  3. 无数据时灌 seed（幂等：按表是否已有记录判断）
 */
export function bootstrap(): void {
  ensureSchemaTable();

  // 先建所有物理表（顺序：role/user 先于 course，满足外键引用）。
  // 内置 schema 是代码里的唯一真相源，每次启动都覆盖注册到元表（保留首次 createdAt）。
  for (const schema of builtinSchemas) {
    migrateSchema(schema);
    upsertSchema(schema);
  }

  seedIfEmpty();
}

/** 仅在空表时灌入 seed 数据，避免重复启动累积重复记录。 */
function seedIfEmpty(): void {
  const seeds = createSeedRecords();

  // 按 builtinSchemas 顺序（role → user → course）灌入，满足外键依赖
  for (const schema of builtinSchemas) {
    const records = seeds[schema.meta.name];
    if (!records || countRecords(schema) > 0) continue;
    for (const record of records) {
      // seed 记录自带 id，createRecord 的幂等 upsert 保证可重复执行
      createRecord(schema, record as Record<string, unknown>);
    }
  }
}
