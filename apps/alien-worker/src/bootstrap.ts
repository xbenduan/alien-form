import {
  builtinSchemas,
  SYS_ADMIN_ID,
  SYS_ADMIN_NICKNAME,
  SYS_ADMIN_USERNAME,
  SYS_ADMIN_DEFAULT_PASSWORD,
} from "./domain/schemas/index.ts";
import { hashPassword } from "./services/auth/password.ts";
import type { Container } from "./container.ts";

/**
 * 启动初始化（幂等）：
 *  1. 把内置模型 schema 强制同步进 schemas 表（以代码为唯一真相源）
 *  2. 写入默认系统管理员
 *
 * 建表由 D1 migrations 完成，bootstrap 只登记内置 schema 与内置数据。
 * D1 无常驻进程，改为每个请求前确保内置状态存在，由模块级 `ensured` 标记
 * 保证同一 isolate 只跑一次，冷启动才重新同步。
 *
 * 注意：动态创建的业务模型（POST /api/schemas）是一等公民，必须持久化。
 * bootstrap 只同步内置模型，绝不删除非内置模型 —— 否则 isolate 冷启动会静默
 * 抹掉用户创建的全部业务模型。
 */
let ensured = false;

export async function ensureBootstrapped(container: Container): Promise<void> {
  if (ensured) return;

  for (const schema of builtinSchemas) {
    await container.schemaStore.upsert(schema);
  }
  await ensureSysAdmin(container);
  ensured = true;
}

/** 写入默认系统管理员（幂等）：账号 _sys_admin，密码 alien123456，创建者为自身。 */
async function ensureSysAdmin(container: Container): Promise<void> {
  const schema = builtinSchemas.find((item) => item.meta.name === "_sys_user");
  if (!schema) return;
  const { recordStore } = container;
  const existing =
    (await recordStore.get(schema, SYS_ADMIN_ID)) ??
    (await recordStore.findByField(schema, "username", SYS_ADMIN_USERNAME));
  if (existing) return;
  await recordStore.create(schema, {
    id: SYS_ADMIN_ID,
    username: SYS_ADMIN_USERNAME,
    nickname: SYS_ADMIN_NICKNAME,
    passwordHash: await hashPassword(SYS_ADMIN_DEFAULT_PASSWORD),
    createBy: SYS_ADMIN_ID,
    remark: "系统内置管理员（首次启动自动创建）。",
  });
}
