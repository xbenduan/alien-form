import { escapePointer } from "formwork/model";
import type { ModelDefinition, DataSchema, StorageBinding } from "formwork/model";
import type { Env, StorageManifest } from "./contracts";
import { createTableSql } from "./adapters/d1/compiler/storage";
import { hashPassword, tokenHash } from "./application/auth/password";
import { ServiceError } from "./http/errors";

function systemDefinition(
  id: string,
  title: string,
  table: string,
  properties: Record<string, DataSchema>,
  required: string[],
  rules: string[],
): ModelDefinition {
  const bindings: StorageBinding[] = Object.entries(properties).map(([key, schema]) => ({
    id: `${id}:${key}`,
    path: `/${escapePointer(key)}`,
    ...(key === "password" ? { jsonKey: key } : { column: key }),
    sqlType: "type" in schema && schema.type === "boolean" ? "INTEGER" : "TEXT",
    encoding:
      "type" in schema && (schema.type === "array" || schema.type === "object") ? "json" : "scalar",
    ...(["username", "code"].includes(key) ? { index: "unique" as const } : {}),
  }));
  return {
    document: {
      id,
      title,
      data: { type: "object", properties, required, additionalProperties: false },
    },
    backend: {
      storage: { table, bindings },
      relations: [],
      permissions: { grants: [], privateFields: keyPrivate(id) },
      behavior: { rules, commands: {}, events: {} },
    },
  };
}
function keyPrivate(id: string) {
  return id === "system-users" ? [`${id}:passwordHash`] : [];
}

/** 首次新库引导系统定义和随机身份入库；已有系统状态不重置账号或模型。 */
export async function bootstrap(env: Env): Promise<void> {
  const db = env.DB;
  if (await db.prepare("SELECT 1 FROM fw_system_identities WHERE name = 'bootstrap'").first())
    return;
  if (!env.FORMWORK_BOOTSTRAP_ADMIN_USERNAME || !env.FORMWORK_BOOTSTRAP_ADMIN_PASSWORD)
    throw new ServiceError("INITIALIZATION_REQUIRED", "新数据库需要配置管理员引导账号和密码", 500);
  const adminId = crypto.randomUUID(),
    superId = crypto.randomUUID();
  const now = new Date().toISOString();
  const roles = systemDefinition(
    "system-roles",
    "角色管理",
    "sys_roles",
    {
      code: { type: "string", minLength: 1 },
      name: { type: "string", minLength: 1 },
      parentId: { type: ["string", "null"] },
      canCreateModel: { type: "boolean", default: false },
    },
    ["code", "name"],
    ["system.roles"],
  );
  const users = systemDefinition(
    "system-users",
    "用户管理",
    "sys_users",
    {
      username: { type: "string", minLength: 1 },
      password: { type: "string", title: "密码", description: "留空保持原密码" },
      passwordHash: { type: "string", readOnly: true },
      roleId: { type: "array", items: { type: "string" }, minItems: 1 },
    },
    ["username", "passwordHash", "roleId"],
    ["system.password", "system.users"],
  );
  roles.backend.relations = [
    {
      fieldId: "system-roles:parentId",
      targetModel: "system-roles",
      targetFieldId: "id",
      kind: "many-to-one",
    },
  ];
  users.backend.relations = [
    {
      fieldId: "system-users:roleId",
      targetModel: "system-roles",
      targetFieldId: "id",
      kind: "many-to-many",
      through: "sys_user_roles",
    },
  ];
  const categories = systemDefinition(
    "system-model-categories",
    "模型分类",
    "sys_model_categories",
    {
      code: { type: "string" },
      name: { type: "string" },
      aggregate: { type: "boolean", default: false },
    },
    ["code", "name", "aggregate"],
    ["system.categories"],
  );
  const statements: D1PreparedStatement[] = [
    db
      .prepare("INSERT INTO fw_system_identities(name, record_id) VALUES ('bootstrap', ?)")
      .bind(adminId),
    db
      .prepare("INSERT INTO fw_system_identities(name, record_id) VALUES ('super-role', ?)")
      .bind(superId),
  ];
  for (const definition of [roles, users, categories]) {
    const manifest: StorageManifest = {
      table: definition.backend.storage.table,
      bindings: definition.backend.storage.bindings.map((binding) => ({
        ...binding,
        active: true,
      })),
      relations: definition.backend.relations.map((relation) => ({
        ...relation,
        active: true,
        table: relation.through,
      })),
    };
    const revision = crypto.randomUUID();
    statements.push(
      db.prepare(createTableSql(manifest.table, manifest.bindings)),
      db
        .prepare(`INSERT INTO fw_models(id, creator_id, active_version, management_revision, storage_table, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?, ?, ?)`)
        .bind(definition.document.id, adminId, revision, manifest.table, now, now),
      db
        .prepare(`INSERT INTO fw_model_versions(model_id, version, definition_json, storage_manifest_json,
        publish_revision, published_by, published_at) VALUES (?, 1, ?, ?, ?, ?, ?)`)
        .bind(
          definition.document.id,
          JSON.stringify(definition),
          JSON.stringify(manifest),
          crypto.randomUUID(),
          adminId,
          now,
        ),
    );
  }
  statements.push(
    db.prepare(`CREATE UNIQUE INDEX sys_users_username ON sys_users(username)`),
    db.prepare(`CREATE UNIQUE INDEX sys_roles_code ON sys_roles(code)`),
    db.prepare(`CREATE UNIQUE INDEX sys_categories_code ON sys_model_categories(code)`),
    db.prepare(
      `CREATE TABLE sys_user_roles(source_id TEXT NOT NULL, target_value TEXT NOT NULL, PRIMARY KEY(source_id, target_value))`,
    ),
    db.prepare(
      "INSERT INTO fw_relation_tables(source_model_id, field_id, table_name) VALUES ('system-users', 'system-users:roleId', 'sys_user_roles')",
    ),
    db
      .prepare(`INSERT INTO sys_roles(id, code, name, canCreateModel, created_at, updated_at, creator_id)
      VALUES (?, 'super_admin', '超级管理员', 1, ?, ?, ?)`)
      .bind(superId, now, now, adminId),
    db
      .prepare(`INSERT INTO sys_users(id, username, passwordHash, roleId, created_at, updated_at, creator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        adminId,
        env.FORMWORK_BOOTSTRAP_ADMIN_USERNAME,
        await hashPassword(env.FORMWORK_BOOTSTRAP_ADMIN_PASSWORD),
        JSON.stringify([superId]),
        now,
        now,
        adminId,
      ),
    db
      .prepare("INSERT INTO sys_user_roles(source_id, target_value) VALUES (?, ?)")
      .bind(adminId, superId),
  );
  for (const [code, name, aggregate] of [
    ["all", "全部", 1],
    ["system", "系统", 0],
    ["other", "其他", 0],
  ] as const) {
    const id = crypto.randomUUID();
    statements.push(
      db
        .prepare("INSERT INTO fw_system_identities(name, record_id) VALUES (?, ?)")
        .bind(`category:${code}`, id),
      db
        .prepare(`INSERT INTO sys_model_categories(id, code, name, aggregate, created_at, updated_at, creator_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, code, name, aggregate, now, now, adminId),
    );
  }
  if (env.FORMWORK_CAPABILITY_TOKEN)
    statements.push(
      db
        .prepare(`INSERT INTO fw_credentials(id, token_hash, user_id, kind, expires_at, label)
      VALUES (?, ?, ?, 'deploy', ?, '本地能力清单')`)
        .bind(
          crypto.randomUUID(),
          await tokenHash(env.FORMWORK_CAPABILITY_TOKEN),
          adminId,
          new Date(Date.now() + 365 * 86_400_000).toISOString(),
        ),
    );
  try {
    await db.batch(statements);
  } catch (error) {
    if (!(await db.prepare("SELECT 1 FROM fw_system_identities WHERE name = 'bootstrap'").first()))
      throw error;
  }
}
