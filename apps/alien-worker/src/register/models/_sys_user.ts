import { forbidden } from "../../errors.ts";
import { SYS_ROLE_MODEL, SYS_ROLE_SUPER_ADMIN_ID } from "../../domain/schemas/_sys_role.ts";
import { SYS_ADMIN_ID, SYS_ADMIN_USERNAME, sysUserSchema } from "../../domain/schemas/_sys_user.ts";
import { hashPassword } from "../../services/auth/password.ts";
import type { ModelRegistry } from "../registry.ts";

/** Registers account validation, password hashing, and administrator protection. */
export function registerSysUser(registry: ModelRegistry): void {
  registry.model(sysUserSchema.name, {
    schema: sysUserSchema,
    async transform(values, { actorId, operation, previous }) {
      const next = { ...values };
      const password = typeof next.password === "string" ? next.password : "";
      delete next.password;
      if (password) next.passwordHash = await hashPassword(password);
      if (operation === "create" && !next.passwordHash) throw new Error("password 不能为空");
      next.nickname = String(next.username ?? previous?.username ?? "");
      next.createBy = previous?.createBy ?? actorId;
      if (String(next.id ?? previous?.id ?? "") === SYS_ADMIN_ID) {
        next.roleId = [SYS_ROLE_SUPER_ADMIN_ID];
        next.super = true;
      } else {
        if (Array.isArray(next.roleId)) {
          next.roleId = [
            ...new Set(
              next.roleId.filter(
                (roleId): roleId is string => typeof roleId === "string" && !!roleId,
              ),
            ),
          ];
        }
        next.super = false;
      }
      return next;
    },
    validators: {
      username(value, { record }) {
        if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_.-]{2,63}$/.test(value)) {
          throw new Error("username 必须为 3-64 位合法账号");
        }
        if (record.id === SYS_ADMIN_ID && value !== SYS_ADMIN_USERNAME) {
          throw forbidden("系统管理员账号不可修改");
        }
      },
    },
    async validate({ record, models, records }) {
      const roleIds = record.roleId;
      if (
        record.username === SYS_ADMIN_USERNAME &&
        (record.super !== true ||
          !Array.isArray(roleIds) ||
          roleIds.length !== 1 ||
          roleIds[0] !== SYS_ROLE_SUPER_ADMIN_ID)
      ) {
        throw new Error("系统管理员必须保持超级管理员角色");
      }
      if (
        !Array.isArray(roleIds) ||
        roleIds.length === 0 ||
        roleIds.some((roleId) => typeof roleId !== "string" || roleId === "")
      ) {
        throw new Error("用户必须关联至少一个有效角色");
      }
      if (record.id !== SYS_ADMIN_ID && roleIds.includes(SYS_ROLE_SUPER_ADMIN_ID)) {
        throw forbidden("超级管理员角色仅可分配给系统管理员");
      }
      const roleSchema = await models.get(SYS_ROLE_MODEL);
      if (!roleSchema) throw new Error("用户必须关联至少一个有效角色");
      const roles = await Promise.all(roleIds.map((roleId) => records.get(roleSchema, roleId)));
      if (roles.some((role) => !role)) {
        throw new Error("用户关联了不存在的角色");
      }
    },
    hooks: {
      beforeDelete({ record }) {
        if (record.id === SYS_ADMIN_ID) throw forbidden("超级管理员不可删除");
      },
    },
  });
}
