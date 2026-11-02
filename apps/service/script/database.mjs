import { rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

/** 定义当前服务需要的完整 metadata 表结构，供部署和独立测试共用。 */
export const databaseSchema = `
CREATE TABLE IF NOT EXISTS fw_models (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  active_version INTEGER,
  management_revision TEXT NOT NULL,
  storage_table TEXT UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fw_model_drafts (
  model_id TEXT PRIMARY KEY REFERENCES fw_models(id),
  base_version INTEGER,
  definition_json TEXT NOT NULL,
  diagnostics_json TEXT NOT NULL,
  validated_manifest_revision TEXT,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fw_model_versions (
  model_id TEXT NOT NULL REFERENCES fw_models(id),
  version INTEGER NOT NULL CHECK(version > 0),
  definition_json TEXT NOT NULL,
  storage_manifest_json TEXT NOT NULL,
  publish_revision TEXT NOT NULL UNIQUE,
  manifest_revision TEXT,
  published_by TEXT NOT NULL,
  published_at TEXT NOT NULL,
  PRIMARY KEY(model_id, version)
);
CREATE TRIGGER IF NOT EXISTS fw_versions_immutable_update BEFORE UPDATE ON fw_model_versions
BEGIN SELECT RAISE(ABORT, 'published versions are immutable'); END;
CREATE TRIGGER IF NOT EXISTS fw_versions_immutable_delete BEFORE DELETE ON fw_model_versions
BEGIN SELECT RAISE(ABORT, 'published versions are immutable'); END;
CREATE TABLE IF NOT EXISTS fw_capability_manifests (
  app_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  client_origin TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  PRIMARY KEY(app_id, revision)
);
CREATE TABLE IF NOT EXISTS fw_capability_heads (
  app_id TEXT PRIMARY KEY,
  revision TEXT NOT NULL,
  FOREIGN KEY(app_id, revision) REFERENCES fw_capability_manifests(app_id, revision)
);
CREATE TABLE IF NOT EXISTS fw_credentials (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('user', 'agent', 'deploy')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  label TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS fw_credentials_user ON fw_credentials(user_id);
CREATE TABLE IF NOT EXISTS fw_relation_tables (
  source_model_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  table_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  PRIMARY KEY(source_model_id, field_id)
);
CREATE TABLE IF NOT EXISTS fw_commit_guards (
  id TEXT PRIMARY KEY,
  ok INTEGER NOT NULL CHECK(ok = 1)
);
CREATE TABLE IF NOT EXISTS fw_outbox (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  model_version INTEGER NOT NULL,
  topic TEXT NOT NULL,
  handler TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE TABLE IF NOT EXISTS fw_system_identities (
  name TEXT PRIMARY KEY,
  record_id TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS fw_model_menu_pins (
  user_id TEXT NOT NULL,
  model_id TEXT NOT NULL REFERENCES fw_models(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id, model_id)
);
`;

/** 返回按用户和仓库隔离的本地部署目录，也支持 FORMWORK_DATA_DIR。 */
export function developmentDirectory() {
  const repository = fileURLToPath(new URL("../../../", import.meta.url));
  return (
    process.env.FORMWORK_DATA_DIR ??
    join(
      homedir(),
      ".local/share/alien-form/development",
      createHash("sha256").update(repository).digest("hex").slice(0, 16),
    )
  );
}

/**
 * 按当前表结构初始化 D1，本地部署先删除整个持久化 state。
 * @param options local 为 true 时 state 必须指向本次本地部署的 D1 目录。
 * @param options.execute 接收 Wrangler 参数的执行函数。
 */
export async function initializeDatabase({ directory, state, execute, common, local }) {
  if (local) {
    if (!state || resolve(state) !== resolve(directory, "state"))
      throw new Error("本地重建只能清空部署目录下的 state");
    await rm(state, { recursive: true, force: true });
  }
  const file = join(directory, "schema.sql");
  await writeFile(file, databaseSchema, { mode: 0o600 });
  await execute(["d1", "execute", "DB", ...common, "--file", file, "--yes"]);
}
