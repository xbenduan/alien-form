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
  SYS_MODEL_CATEGORY_ALL_ID,
  SYS_MODEL_CATEGORY_MODEL,
  SYS_MODEL_CATEGORY_OTHER_ID,
  SYS_MODEL_CATEGORY_SYSTEM_ID,
} from "./domain/schemas/_sys_model_category.ts";
import { hashPassword } from "./services/auth/password.ts";
import type { Container } from "./container.ts";

/** Creates missing built-in models without overwriting user-published configuration. */
export async function ensureBootstrapped(container: Container): Promise<void> {
  if (container.db) await migrateLegacyModelCategory(container.db);
  for (const [, registration] of container.models.entries()) {
    if (!registration.schema) continue;
    await container.modelService.ensureSystemModel(registration.schema);
  }
  await ensureRoles(container);
  await ensureModelCategories(container);
  await ensureSysAdmin(container);
}

/** Finishes the dynamic-table part of the model category rename once per database. */
async function migrateLegacyModelCategory(db: D1Database): Promise<void> {
  const migration = "migration:model-category";
  if (await db.prepare(`SELECT 1 FROM "_sequences" WHERE "name" = ?`).bind(migration).first()) {
    return;
  }

  const [legacyTable, categoryTable, roleTable] = await Promise.all([
    db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_sys_model_tab'`)
      .first(),
    db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_sys_model_category'`)
      .first(),
    db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_sys_role'`).first(),
  ]);
  if (legacyTable && categoryTable) {
    throw new Error("模型分类迁移失败：新旧物理表同时存在");
  }

  const statements: D1PreparedStatement[] = [];
  if (legacyTable) {
    statements.push(db.prepare(`ALTER TABLE "_sys_model_tab" RENAME TO "_sys_model_category"`));
  }
  if (legacyTable || categoryTable) {
    statements.push(
      db.prepare(
        `UPDATE "_sys_model_category"
         SET "id" = CASE "id"
           WHEN 'SYSTAB000001' THEN 'SYSCATEGORY000001'
           WHEN 'SYSTAB000002' THEN 'SYSCATEGORY000002'
           WHEN 'SYSTAB000003' THEN 'SYSCATEGORY000003'
           ELSE "id"
         END`,
      ),
      db.prepare(`DROP INDEX IF EXISTS "uidx__sys_model_tab_code"`),
      db.prepare(`DROP INDEX IF EXISTS "idx__sys_model_tab_code"`),
      db.prepare(`DROP INDEX IF EXISTS "idx__sys_model_tab_name"`),
      db.prepare(`DROP INDEX IF EXISTS "idx__sys_model_tab_order"`),
      db.prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS "uidx__sys_model_category_code"
         ON "_sys_model_category" ("code")`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS "idx__sys_model_category_code"
         ON "_sys_model_category" ("code")`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS "idx__sys_model_category_name"
         ON "_sys_model_category" ("name")`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS "idx__sys_model_category_order"
         ON "_sys_model_category" ("order")`,
      ),
    );
  }
  if (roleTable) {
    statements.push(
      db.prepare(
        `UPDATE "_sys_role"
         SET "data_content" = replace(
           "data_content",
           '"model":"_sys_model_tab"',
           '"model":"_sys_model_category"'
         )
         WHERE "data_content" LIKE '%"model":"_sys_model_tab"%'`,
      ),
    );
  }
  statements.push(
    db.prepare(`INSERT INTO "_sequences" ("name", "next") VALUES (?, 1)`).bind(migration),
  );
  await db.batch(statements);
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

/** Seeds categories used by the model home page and editor. */
async function ensureModelCategories(container: Container): Promise<void> {
  await ensureRecord(container, SYS_MODEL_CATEGORY_MODEL, SYS_MODEL_CATEGORY_ALL_ID, {
    code: "all",
    name: "全部",
    order: 0,
    aggregate: true,
    description: "聚合展示全部可访问模型。",
  });
  await ensureRecord(container, SYS_MODEL_CATEGORY_MODEL, SYS_MODEL_CATEGORY_SYSTEM_ID, {
    code: "system",
    name: "系统",
    order: 10,
    aggregate: false,
    description: "系统内置模型。",
  });
  await ensureRecord(container, SYS_MODEL_CATEGORY_MODEL, SYS_MODEL_CATEGORY_OTHER_ID, {
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
    if (
      !Array.isArray(existing.roleId) ||
      existing.roleId.length !== 1 ||
      existing.roleId[0] !== SYS_ADMIN_ROLE_ID ||
      existing.super !== true
    ) {
      await container.recordService.update(
        schema.name,
        existing.id,
        { roleId: [SYS_ADMIN_ROLE_ID] },
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
      roleId: [SYS_ADMIN_ROLE_ID],
      createBy: SYS_ADMIN_ID,
      super: true,
      remark: "系统内置管理员（首次启动自动创建）。",
    },
    SYS_ADMIN_ID,
  );
}
