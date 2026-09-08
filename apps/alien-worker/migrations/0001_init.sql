CREATE TABLE IF NOT EXISTS "models" (
  "name"       TEXT PRIMARY KEY,
  "title"      TEXT NOT NULL,
  "table_name" TEXT NOT NULL UNIQUE,
  "version"    INTEGER NOT NULL,
  "schema"     TEXT NOT NULL,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "token"      TEXT PRIMARY KEY,
  "user_id"    TEXT NOT NULL,
  "provider"   TEXT NOT NULL,
  "created_at" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "_sequences" (
  "name" TEXT PRIMARY KEY,
  "next" INTEGER NOT NULL
);
