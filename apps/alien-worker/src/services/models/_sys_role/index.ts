import { forbidden } from "../../../errors.ts";
import { defineModel } from "../../define-model.ts";
import type { ModelValidationContext } from "../../core/contracts.ts";
import { initialize } from "./database.ts";
import createSchema from "./schema.ts";

export default defineModel(() => {
  const constants = {
    code: "_sys_role",
    superAdminId: "SYSROLE000001",
    adminId: "SYSROLE000002",
    userId: "SYSROLE000003",
    superAdminCode: "super_admin",
    adminCode: "admin",
    userCode: "user",
  } as const;
  const userModelCode = "_sys_user";
  const bootstrapActorId = "MDM0000000000";
  const actions = new Set(["read", "create", "update", "delete"]);
  const scopes = new Set(["all", "own"]);

  async function validatePermission(
    value: unknown,
    context: ModelValidationContext,
  ): Promise<void> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("权限配置格式不合法");
    }
    const permission = value as Record<string, unknown>;
    if (typeof permission.model !== "string") throw new Error("权限模型不能为空");
    const model = await context.models.get(permission.model);
    if (!model) throw new Error(`权限模型不存在：${permission.model}`);
    if (
      !Array.isArray(permission.actions) ||
      permission.actions.length === 0 ||
      permission.actions.some((action) => typeof action !== "string" || !actions.has(action))
    ) {
      throw new Error(`模型 ${permission.model} 的操作权限不合法`);
    }
    if (
      !Array.isArray(permission.fields) ||
      permission.fields.some((field) => typeof field !== "string")
    ) {
      throw new Error(`模型 ${permission.model} 的字段权限不合法`);
    }
    const fields = new Set(model.schema.fields.map((field) => field.key));
    const invalidField = permission.fields.find((field) => !fields.has(String(field)));
    if (invalidField !== undefined) {
      throw new Error(`模型 ${permission.model} 不存在字段：${String(invalidField)}`);
    }
    if (typeof permission.scope !== "string" || !scopes.has(permission.scope)) {
      throw new Error(`模型 ${permission.model} 的数据范围不合法`);
    }
  }

  async function validateParent(context: ModelValidationContext): Promise<void> {
    const { record, records, model } = context;
    if (record.id === constants.superAdminId) {
      if (context.operation === "update") throw forbidden("超级管理员角色不可修改");
      if (context.actorId !== bootstrapActorId) {
        throw forbidden("超级管理员角色仅可由系统初始化");
      }
      if (record.parentId !== undefined && record.parentId !== null && record.parentId !== "") {
        throw new Error("超级管理员必须是根节点");
      }
      if (record.code !== constants.superAdminCode) {
        throw new Error("超级管理员角色编码不可修改");
      }
      return;
    }

    if (typeof record.parentId !== "string" || record.parentId === "") {
      throw new Error("非根角色必须选择父级角色");
    }
    if (record.parentId === record.id) throw new Error("角色不能选择自身作为父级");
    if (!(await records.get(model, record.parentId))) throw new Error("父级角色不存在");
    if (context.operation === "create") return;

    const descendants = await records.subtree(model, {
      idField: "id",
      parentField: "parentId",
      parentValue: record.id,
    });
    if (descendants.some((item) => item.id === record.parentId)) {
      throw new Error("父级角色不能选择当前角色的后代节点");
    }
  }

  return {
    schema: createSchema(constants),
    constants,
    database: {
      initialize: (context) => initialize(context, constants, bootstrapActorId),
    },
    middleware: {
      async validate(context) {
        const { record } = context;
        if (typeof record.code !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(record.code)) {
          throw new Error("角色编码不合法");
        }
        if (typeof record.name !== "string" || record.name.trim() === "") {
          throw new Error("角色名称不能为空");
        }
        if (typeof record.canCreateModel !== "boolean") {
          throw new Error("是否允许新建模型必须为布尔值");
        }
        await validateParent(context);
        const permissions = record.permissions;
        if (permissions === undefined) return;
        if (!Array.isArray(permissions)) throw new Error("权限配置必须为数组");
        await Promise.all(permissions.map((permission) => validatePermission(permission, context)));
      },
      async beforePersist({ operation, record, model, models, records }) {
        if (operation !== "delete") return;
        if (record.id === constants.superAdminId) {
          throw forbidden("超级管理员角色不可删除");
        }
        if (await records.findByField(model, "parentId", record.id)) {
          throw forbidden("存在子角色，无法删除");
        }
        const userModel = await models.get(userModelCode);
        if (userModel && (await records.findByField(userModel, "roleId", record.id))) {
          throw forbidden("存在关联用户，无法删除");
        }
      },
    },
  };
});
