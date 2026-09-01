import type { ModelSchema } from "../schema/types.ts";
import { sysUserSchema } from "./_sys_user.ts";

/**
 * 内置基础模型：仅系统用户模型 _sys_user（用于登录与账号管理）。
 * 数组顺序即建表顺序。
 */
export const builtinSchemas: ModelSchema[] = [sysUserSchema];

export { sysUserSchema };
