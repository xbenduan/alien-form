import { builtinSchemas } from "../../../alien-server/src/schemas/index.ts";
import {
  SYS_ADMIN_ID,
  SYS_ADMIN_NICKNAME,
  SYS_ADMIN_USERNAME,
  SYS_ADMIN_DEFAULT_PASSWORD,
} from "../../../alien-server/src/schemas/_sys_user.ts";
import { listSchemas, removeSchema, upsertSchema } from "./schemas.ts";
import { createRecord, findRecordByField, getRecord } from "./records.ts";
import { hashPassword } from "../routes/auth.ts";

/**
 * 启动初始化（幂等）：
 *  1. 清理历史（非内置）模型登记
 *  2. 把内置模型 schema 强制同步进 schemas 表（以代码为唯一真相源）
 *  3. 写入默认系统管理员
 *
 * 与 Node 版不同，这里没有「一模型一物理表」的 DDL —— 所有记录共用 records 表，
 * 建表由 D1 migrations 完成，故 bootstrap 只需登记 schema 与内置数据。
 *
 * D1 无常驻进程，无法在启动时跑一次；改为每个请求前确保内置状态存在，
 * 由模块级 `ensured` 标记保证同一 isolate 只跑一次，冷启动才重新同步。
 *
 * 内置模型（如 _sys_user）的结构以代码为准：一旦 schema 格式演进，旧格式的
 * 存量记录必须被覆盖，否则 formProperties 之类的运行时校验会持续抛错。
 */
let ensured = false;

export async function ensureBootstrapped(db: D1Database): Promise<void> {
  if (ensured) return;

  const keep = new Set(builtinSchemas.map((schema) => schema.meta.name));
  for (const entry of await listSchemas(db)) {
    const name = entry.schema.meta.name;
    if (!keep.has(name)) await removeSchema(db, name);
  }

  for (const schema of builtinSchemas) {
    await upsertSchema(db, schema);
  }

  await ensureSysAdmin(db);
  ensured = true;
}

/** 写入默认系统管理员（幂等）：账号 _sys_admin，密码 alien123456，创建者为自身。 */
async function ensureSysAdmin(db: D1Database): Promise<void> {
  const schema = builtinSchemas.find((item) => item.meta.name === "_sys_user");
  if (!schema) return;
  const existing =
    (await getRecord(db, schema, SYS_ADMIN_ID)) ??
    (await findRecordByField(db, schema, "username", SYS_ADMIN_USERNAME));
  if (existing) return;
  await createRecord(db, schema, {
    id: SYS_ADMIN_ID,
    username: SYS_ADMIN_USERNAME,
    nickname: SYS_ADMIN_NICKNAME,
    passwordHash: await hashPassword(SYS_ADMIN_DEFAULT_PASSWORD),
    createBy: SYS_ADMIN_ID,
    remark: "系统内置管理员（首次启动自动创建）。",
  });
}
