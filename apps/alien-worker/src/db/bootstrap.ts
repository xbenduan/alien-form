import { builtinSchemas } from "../../../alien-server/src/schemas/index.ts";
import { hasSchema, upsertSchema } from "./schemas.ts";

/**
 * 启动初始化（幂等）：把内置模型 schema 注册进 schemas 表。
 *
 * 与 Node 版不同，这里没有「一模型一物理表」的 DDL —— 所有记录共用 records 表，
 * 建表由 D1 migrations 完成，故 bootstrap 只需登记 schema。
 *
 * D1 无常驻进程，无法在启动时跑一次；改为每个请求前确保内置 schema 存在（missing 才写）。
 * 已存在的用户改动过的 schema 不覆盖，避免每请求写放大。
 */
let ensured = false;

export async function ensureBootstrapped(db: D1Database): Promise<void> {
  if (ensured) return;
  for (const schema of builtinSchemas) {
    if (!(await hasSchema(db, schema.meta.name))) {
      await upsertSchema(db, schema);
    }
  }
  ensured = true;
}
