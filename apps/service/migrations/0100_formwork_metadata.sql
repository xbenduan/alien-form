-- New protocol metadata. Legacy tables and records remain untouched.
CREATE TABLE fw_models (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  active_version INTEGER,
  management_revision TEXT NOT NULL,
  storage_table TEXT UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE fw_model_drafts (
  model_id TEXT PRIMARY KEY REFERENCES fw_models(id),
  base_version INTEGER,
  definition_json TEXT NOT NULL,
  diagnostics_json TEXT NOT NULL,
  validated_manifest_revision TEXT,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE fw_model_versions (
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
CREATE TRIGGER fw_versions_immutable_update BEFORE UPDATE ON fw_model_versions
BEGIN SELECT RAISE(ABORT, 'published versions are immutable'); END;
CREATE TRIGGER fw_versions_immutable_delete BEFORE DELETE ON fw_model_versions
BEGIN SELECT RAISE(ABORT, 'published versions are immutable'); END;
CREATE TABLE fw_capability_manifests (
  app_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  client_origin TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  PRIMARY KEY(app_id, revision)
);
CREATE TABLE fw_capability_heads (
  app_id TEXT PRIMARY KEY,
  revision TEXT NOT NULL,
  FOREIGN KEY(app_id, revision) REFERENCES fw_capability_manifests(app_id, revision)
);
CREATE TABLE fw_credentials (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('user', 'agent', 'deploy')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  label TEXT NOT NULL
);
CREATE INDEX fw_credentials_user ON fw_credentials(user_id);
CREATE TABLE fw_relation_tables (
  source_model_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  table_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  PRIMARY KEY(source_model_id, field_id)
);
CREATE TABLE fw_commit_guards (
  id TEXT PRIMARY KEY,
  ok INTEGER NOT NULL CHECK(ok = 1)
);
CREATE TABLE fw_outbox (
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
CREATE TABLE fw_migration_runs (
  input_hash TEXT PRIMARY KEY,
  mapping_json TEXT NOT NULL,
  status TEXT NOT NULL,
  report_json TEXT NOT NULL,
  completed_at TEXT
);
-- Trusted identity markers cannot be written through record/model APIs.
CREATE TABLE fw_system_identities (
  name TEXT PRIMARY KEY,
  record_id TEXT NOT NULL UNIQUE
);
