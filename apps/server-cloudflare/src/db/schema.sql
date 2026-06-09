-- Alien CMS D1 Schema
-- Run: wrangler d1 execute alien-cms --local --file=src/db/schema.sql

CREATE TABLE IF NOT EXISTS cms_schemas (
  model_name TEXT PRIMARY KEY,
  schema_json TEXT NOT NULL,
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cms_records (
  id TEXT PRIMARY KEY,
  model_name TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_records_model ON cms_records(model_name);
CREATE INDEX IF NOT EXISTS idx_records_updated ON cms_records(updated_at DESC);

CREATE TABLE IF NOT EXISTS cms_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  model_name TEXT NOT NULL,
  record_id TEXT,
  operator TEXT,
  summary TEXT,
  changes_json TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_model ON cms_logs(model_name);
CREATE INDEX IF NOT EXISTS idx_logs_action ON cms_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON cms_logs(timestamp DESC);
