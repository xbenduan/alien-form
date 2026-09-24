import type { ModelDatabaseContext } from "@alien-form/alienbase";
import { ensureRecord } from "@alien-form/alienbase";

/** Creates or minimally migrates one editable default role. */
async function ensureDefaultRole(
  context: ModelDatabaseContext,
  modelCode: string,
  actorId: string,
  id: string,
  values: Record<string, unknown>,
): Promise<void> {
  const model = await context.models.get(modelCode);
  if (!model) throw new Error(`内置模型未注册：${modelCode}`);
  const existing = await context.records.get(model, id);
  if (!existing) {
    await context.create(modelCode, { id, ...values }, actorId);
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
    await context.update(modelCode, id, patch, actorId);
  }
}

/** Seeds the fixed root and two editable starter branches. */
export async function initialize(
  context: ModelDatabaseContext,
  constants: {
    readonly code: string;
    readonly superAdminId: string;
    readonly adminId: string;
    readonly userId: string;
    readonly superAdminCode: string;
    readonly adminCode: string;
    readonly userCode: string;
  },
  actorId: string,
): Promise<void> {
  await ensureRecord(
    context,
    constants.code,
    constants.superAdminId,
    {
      code: constants.superAdminCode,
      name: "超级管理员",
      canCreateModel: true,
      permissions: [],
    },
    actorId,
  );
  await ensureDefaultRole(context, constants.code, actorId, constants.adminId, {
    code: constants.adminCode,
    name: "管理员",
    parentId: constants.superAdminId,
    canCreateModel: true,
    permissions: [],
  });
  await ensureDefaultRole(context, constants.code, actorId, constants.userId, {
    code: constants.userCode,
    name: "用户",
    parentId: constants.superAdminId,
    canCreateModel: false,
    permissions: [],
  });
}
