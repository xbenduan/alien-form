import {
  SYS_ADMIN_DEFAULT_PASSWORD,
  SYS_ADMIN_ID,
  SYS_ADMIN_ROLE_ID,
  SYS_ADMIN_USERNAME,
} from "./domain/schemas/_sys_user.ts";
import {
  SYS_ROLE_ADMIN,
  SYS_ROLE_ADMIN_ID,
  SYS_ROLE_MODEL,
  SYS_ROLE_SUPER_ADMIN,
  SYS_ROLE_SUPER_ADMIN_ID,
  SYS_ROLE_USER,
  SYS_ROLE_USER_ID,
} from "./domain/schemas/_sys_role.ts";
import {
  SYS_MODEL_TAB_ALL_ID,
  SYS_MODEL_TAB_MODEL,
  SYS_MODEL_TAB_OTHER_ID,
  SYS_MODEL_TAB_SYSTEM_ID,
} from "./domain/schemas/_sys_model_tab.ts";
import { hashPassword } from "./services/auth/password.ts";
import type { Container } from "./container.ts";

/** Creates missing built-in models without overwriting user-published configuration. */
export async function ensureBootstrapped(container: Container): Promise<void> {
  for (const [, registration] of container.models.entries()) {
    if (!registration.schema) continue;
    await container.modelService.ensureSystemModel(registration.schema);
  }
  await ensureRoles(container);
  await ensureModelTabs(container);
  await ensureSysAdmin(container);
}

/** Creates a record with a stable ID only when it does not already exist. */
async function ensureRecord(
  container: Container,
  model: string,
  id: string,
  values: Record<string, unknown>,
): Promise<void> {
  const schema = await container.modelStore.get(model);
  if (!schema) throw new Error(`内置模型未发布：${model}`);
  if (await container.recordStore.get(schema, id)) return;
  await container.recordService.create(model, { id, ...values }, SYS_ADMIN_ID);
}

/** Creates or minimally migrates one editable default role. */
async function ensureDefaultRole(
  container: Container,
  id: string,
  values: Record<string, unknown>,
): Promise<void> {
  const schema = await container.modelStore.get(SYS_ROLE_MODEL);
  if (!schema) throw new Error(`内置模型未发布：${SYS_ROLE_MODEL}`);
  const existing = await container.recordStore.get(schema, id);
  if (!existing) {
    await container.recordService.create(SYS_ROLE_MODEL, { id, ...values }, SYS_ADMIN_ID);
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
    await container.recordService.update(SYS_ROLE_MODEL, id, patch, SYS_ADMIN_ID);
  }
}

/** Seeds the fixed root and two editable starter branches. */
async function ensureRoles(container: Container): Promise<void> {
  await ensureRecord(container, SYS_ROLE_MODEL, SYS_ROLE_SUPER_ADMIN_ID, {
    code: SYS_ROLE_SUPER_ADMIN,
    name: "超级管理员",
    description: "拥有全部模型与数据权限。",
    canCreateModel: true,
    permissions: [],
  });
  await ensureDefaultRole(container, SYS_ROLE_ADMIN_ID, {
    code: SYS_ROLE_ADMIN,
    name: "管理员",
    parentId: SYS_ROLE_SUPER_ADMIN_ID,
    canCreateModel: true,
    description: "默认管理分支，可新建并管理自己创建的模型。",
    permissions: [],
  });
  await ensureDefaultRole(container, SYS_ROLE_USER_ID, {
    code: SYS_ROLE_USER,
    name: "用户",
    parentId: SYS_ROLE_SUPER_ADMIN_ID,
    canCreateModel: false,
    description: "默认用户分支，权限由节点配置。",
    permissions: [],
  });
}

/** Seeds navigation tabs used by the model home page and editor. */
async function ensureModelTabs(container: Container): Promise<void> {
  await ensureRecord(container, SYS_MODEL_TAB_MODEL, SYS_MODEL_TAB_ALL_ID, {
    code: "all",
    name: "全部",
    order: 0,
    aggregate: true,
    description: "聚合展示全部可访问模型。",
  });
  await ensureRecord(container, SYS_MODEL_TAB_MODEL, SYS_MODEL_TAB_SYSTEM_ID, {
    code: "system",
    name: "系统",
    order: 10,
    aggregate: false,
    description: "系统内置模型。",
  });
  await ensureRecord(container, SYS_MODEL_TAB_MODEL, SYS_MODEL_TAB_OTHER_ID, {
    code: "other",
    name: "其他",
    order: 20,
    aggregate: false,
    description: "默认业务模型分类。",
  });
}

/** Creates the initial super administrator account. */
async function ensureSysAdmin(container: Container): Promise<void> {
  const schema = await container.modelStore.get("_sys_user");
  if (!schema) throw new Error("内置用户模型未发布");
  const existing =
    (await container.recordStore.get(schema, SYS_ADMIN_ID)) ??
    (await container.recordStore.findByField(schema, "username", SYS_ADMIN_USERNAME));
  if (existing) {
    if (existing.roleId !== SYS_ADMIN_ROLE_ID || existing.super !== true) {
      await container.recordService.update(
        schema.name,
        existing.id,
        { roleId: SYS_ADMIN_ROLE_ID },
        SYS_ADMIN_ID,
      );
    }
    return;
  }
  await container.recordService.create(
    schema.name,
    {
      id: SYS_ADMIN_ID,
      username: SYS_ADMIN_USERNAME,
      passwordHash: await hashPassword(SYS_ADMIN_DEFAULT_PASSWORD),
      roleId: SYS_ADMIN_ROLE_ID,
      createBy: SYS_ADMIN_ID,
      super: true,
      remark: "系统内置管理员（首次启动自动创建）。",
    },
    SYS_ADMIN_ID,
  );
}
