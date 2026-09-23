import type { Container } from "../../../container.ts";
import { ensureRecord } from "../../global/initialization.ts";

/** Creates or minimally migrates one editable default role. */
async function ensureDefaultRole(
  container: Container,
  modelCode: string,
  actorId: string,
  id: string,
  values: Record<string, unknown>,
): Promise<void> {
  const schema = await container.modelStore.get(modelCode);
  if (!schema) throw new Error(`内置模型未发布：${modelCode}`);
  const existing = await container.recordStore.get(schema, id);
  if (!existing) {
    await container.recordService.create(modelCode, { id, ...values }, actorId);
    return;
  }
  const patch: Record<string, unknown> = {};
  if (existing.parentId === undefined && values.parentId !== undefined) {
    patch.parentId = values.parentId;
  }
  if (existing.canCreateModel === undefined) {
    patch.canCreateModel = values.canCreateModel;
  }
  if (Array.isArray(existing.permissions)) {
    const permissions = existing.permissions.map((permission) => {
      if (!permission || typeof permission !== "object" || Array.isArray(permission)) {
        return permission;
      }
      const item = permission as Record<string, unknown>;
      return {
        ...item,
        actions: Array.isArray(item.actions) ? item.actions : ["read"],
        scope: item.scope === "own" ? "own" : "all",
      };
    });
    if (JSON.stringify(permissions) !== JSON.stringify(existing.permissions)) {
      patch.permissions = permissions;
    }
  }
  if (Object.keys(patch).length > 0) {
    await container.recordService.update(modelCode, id, patch, actorId);
  }
}

/** Seeds the fixed root and two editable starter branches. */
export async function initialize(
  container: Container,
  constants: {
    readonly code: string;
    readonly superAdminId: string;
    readonly adminId: string;
    readonly userId: string;
    readonly superAdminCode: string;
    readonly adminCode: string;
    readonly userCode: string;
  },
  userModelCode: string,
): Promise<void> {
  const userModule = await container.modules.get(userModelCode);
  const actorId = userModule?.constants?.adminId;
  if (typeof actorId !== "string") throw new Error(`模型 ${userModelCode} 缺少 adminId 常量`);
  await ensureRecord(
    container,
    constants.code,
    constants.superAdminId,
    {
      code: constants.superAdminCode,
      name: "超级管理员",
      description: "拥有全部模型与数据权限。",
      canCreateModel: true,
      permissions: [],
    },
    actorId,
  );
  await ensureDefaultRole(container, constants.code, actorId, constants.adminId, {
    code: constants.adminCode,
    name: "管理员",
    parentId: constants.superAdminId,
    canCreateModel: true,
    description: "默认管理分支，可新建并管理自己创建的模型。",
    permissions: [],
  });
  await ensureDefaultRole(container, constants.code, actorId, constants.userId, {
    code: constants.userCode,
    name: "用户",
    parentId: constants.superAdminId,
    canCreateModel: false,
    description: "默认用户分支，权限由节点配置。",
    permissions: [],
  });
}
