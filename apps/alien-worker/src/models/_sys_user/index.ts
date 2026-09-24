import { forbidden } from "@alien-form/alienbase";
import { hashPassword } from "../../application/auth/password.ts";
import { defineModel } from "@alien-form/alienbase";
import { initialize } from "./database.ts";
import createSchema from "./schema.ts";
import roleModule from "../_sys_role/index.ts";

export default defineModel(() => {
  const constants = {
    code: "_sys_user",
    adminId: "MDM0000000000",
    adminUsername: "_sys_admin",
    adminDefaultPassword: "alien123456",
  } as const;
  const { superAdminId: superAdminRoleId } = roleModule.constants;

  return {
    schema: createSchema(constants, roleModule.constants.code),
    constants,
    database: {
      initialize: (context) => initialize(context, constants, superAdminRoleId),
    },
    middleware: {
      async prepare(values, { actorId, operation, previous }) {
        const next = { ...values };
        const password = typeof next.password === "string" ? next.password : "";
        delete next.password;
        if (password) next.passwordHash = await hashPassword(password);
        if (operation === "create" && !next.passwordHash) throw new Error("password 不能为空");
        next.nickname = String(next.username ?? previous?.username ?? "");
        next.createBy = previous?.createBy ?? actorId;
        if (String(next.id ?? previous?.id ?? "") === constants.adminId) {
          next.roleId = [superAdminRoleId];
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
      async validate({ record, models, records }) {
        if (
          typeof record.username !== "string" ||
          !/^[A-Za-z_][A-Za-z0-9_.-]{2,63}$/.test(record.username)
        ) {
          throw new Error("username 必须为 3-64 位合法账号");
        }
        if (record.id === constants.adminId && record.username !== constants.adminUsername) {
          throw forbidden("系统管理员账号不可修改");
        }
        const roleIds = record.roleId;
        if (
          record.username === constants.adminUsername &&
          (record.super !== true ||
            !Array.isArray(roleIds) ||
            roleIds.length !== 1 ||
            roleIds[0] !== superAdminRoleId)
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
        if (record.id !== constants.adminId && roleIds.includes(superAdminRoleId)) {
          throw forbidden("超级管理员角色仅可分配给系统管理员");
        }
        const roleSchema = await models.get(roleModule.constants.code);
        if (!roleSchema) throw new Error("用户必须关联至少一个有效角色");
        const roles = await Promise.all(roleIds.map((roleId) => records.get(roleSchema, roleId)));
        if (roles.some((role) => !role)) {
          throw new Error("用户关联了不存在的角色");
        }
      },
      beforePersist({ operation, record }) {
        if (operation === "delete" && record.id === constants.adminId) {
          throw forbidden("超级管理员不可删除");
        }
      },
    },
  };
});
