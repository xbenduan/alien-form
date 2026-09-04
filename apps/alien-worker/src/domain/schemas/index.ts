import type { BuilderSchema as ModelSchema } from "@alien-form/validate";
import { sysUserSchema } from "./_sys_user.ts";

/**
 * 内置基础模型：仅系统用户模型 _sys_user（用于登录与账号管理）。
 * 数组顺序即 bootstrap 同步顺序，以代码为唯一真相源。
 */
export const builtinSchemas: ModelSchema[] = [sysUserSchema];

export { sysUserSchema };
export {
  SYS_ADMIN_ID,
  SYS_ADMIN_USERNAME,
  SYS_ADMIN_NICKNAME,
  SYS_ADMIN_DEFAULT_PASSWORD,
} from "./_sys_user.ts";
