import {
  SYS_ROLE_MODEL,
  SYS_ROLE_SUPER_ADMIN,
  SYS_ROLE_SUPER_ADMIN_ID,
  sysRoleSchema,
} from "../../domain/schemas/_sys_role.ts";
import { SYS_ADMIN_ID, SYS_USER_MODEL } from "../../domain/schemas/_sys_user.ts";
import { forbidden } from "../../errors.ts";
import type { ModelRegistry, ModelValidationContext } from "../registry.ts";

const ACTIONS = new Set(["read", "create", "update", "delete"]);
const SCOPES = new Set(["all", "own"]);

/** Validates one role permission against the referenced model. */
async function validatePermission(value: unknown, context: ModelValidationContext): Promise<void> {
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
    permission.actions.some((action) => typeof action !== "string" || !ACTIONS.has(action))
  ) {
    throw new Error(`模型 ${permission.model} 的操作权限不合法`);
  }
  if (
    !Array.isArray(permission.fields) ||
    permission.fields.some((field) => typeof field !== "string")
  ) {
    throw new Error(`模型 ${permission.model} 的字段权限不合法`);
  }
  const fields = new Set(model.fields.map((field) => field.key));
  const invalidField = permission.fields.find((field) => !fields.has(String(field)));
  if (invalidField !== undefined) {
    throw new Error(`模型 ${permission.model} 不存在字段：${String(invalidField)}`);
  }
  if (typeof permission.scope !== "string" || !SCOPES.has(permission.scope)) {
    throw new Error(`模型 ${permission.model} 的数据范围不合法`);
  }
}

/** Validates parent existence and prevents role-tree cycles. */
async function validateParent(context: ModelValidationContext): Promise<void> {
  const { record, records, model } = context;
  if (record.id === SYS_ROLE_SUPER_ADMIN_ID) {
    if (context.operation === "update") throw forbidden("超级管理员角色不可修改");
    if (context.actorId !== SYS_ADMIN_ID) throw forbidden("超级管理员角色仅可由系统初始化");
    if (record.parentId !== undefined && record.parentId !== null && record.parentId !== "") {
      throw new Error("超级管理员必须是根节点");
    }
    if (record.code !== SYS_ROLE_SUPER_ADMIN) throw new Error("超级管理员角色编码不可修改");
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

/** Registers editable role-tree validation while protecting only the fixed root. */
export function registerSysRole(registry: ModelRegistry): void {
  registry.model(SYS_ROLE_MODEL, {
    schema: sysRoleSchema,
    validators: {
      code(value) {
        if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(value)) {
          throw new Error("角色编码不合法");
        }
      },
      name(value) {
        if (typeof value !== "string" || value.trim() === "") {
          throw new Error("角色名称不能为空");
        }
      },
      canCreateModel(value) {
        if (typeof value !== "boolean") throw new Error("是否允许新建模型必须为布尔值");
      },
    },
    async validate(context) {
      await validateParent(context);
      const permissions = context.record.permissions;
      if (permissions === undefined) return;
      if (!Array.isArray(permissions)) throw new Error("权限配置必须为数组");
      await Promise.all(permissions.map((permission) => validatePermission(permission, context)));
    },
    hooks: {
      async beforeDelete({ record, model, models, records }) {
        if (record.id === SYS_ROLE_SUPER_ADMIN_ID) throw forbidden("超级管理员角色不可删除");
        if (await records.findByField(model, "parentId", record.id)) {
          throw forbidden("存在子角色，无法删除");
        }
        const userModel = await models.get(SYS_USER_MODEL);
        if (userModel && (await records.findByField(userModel, "roleId", record.id))) {
          throw forbidden("存在关联用户，无法删除");
        }
      },
    },
  });
}
