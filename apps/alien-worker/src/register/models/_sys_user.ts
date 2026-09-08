import { forbidden } from "../../errors.ts";
import { SYS_ADMIN_USERNAME, sysUserSchema } from "../../domain/schemas/_sys_user.ts";
import type { ModelRegistry } from "../registry.ts";

export function registerSysUser(registry: ModelRegistry): void {
  registry.model(sysUserSchema.name, {
    schema: sysUserSchema,
    validators: {
      username(value) {
        if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_.-]{2,63}$/.test(value)) {
          throw new Error("username 必须为 3-64 位合法账号");
        }
      },
      nickname(value) {
        if (typeof value !== "string" || value.trim() === "") {
          throw new Error("nickname 不能为空");
        }
      },
    },
    validate({ record }) {
      if (record.username === SYS_ADMIN_USERNAME && record.super !== true) {
        throw new Error("系统管理员必须保持 super=true");
      }
    },
    hooks: {
      beforeDelete({ record }) {
        if (record.super === true) throw forbidden("超级管理员不可删除");
      },
    },
  });
}
