-- System model protocols live in code. Their physical layout is changed only
-- through explicit migrations, never by publishing a model schema.

CREATE TABLE IF NOT EXISTS "_sys_user" (
  "id"           TEXT PRIMARY KEY,
  "username"     TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "created_at"   INTEGER NOT NULL,
  "updated_at"   INTEGER NOT NULL,
  "data_content" TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS "_sys_role" (
  "id"           TEXT PRIMARY KEY,
  "code"         TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "parentId"     TEXT,
  "created_at"   INTEGER NOT NULL,
  "updated_at"   INTEGER NOT NULL,
  "data_content" TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS "_sys_model_category" (
  "id"           TEXT PRIMARY KEY,
  "code"         TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "order"        INTEGER NOT NULL DEFAULT 0,
  "aggregate"    INTEGER NOT NULL DEFAULT 0,
  "created_at"   INTEGER NOT NULL,
  "updated_at"   INTEGER NOT NULL,
  "data_content" TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS "_sys_model_tab" (
  "id"           TEXT PRIMARY KEY,
  "code"         TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "order"        INTEGER NOT NULL DEFAULT 0,
  "aggregate"    INTEGER NOT NULL DEFAULT 0,
  "created_at"   INTEGER NOT NULL,
  "updated_at"   INTEGER NOT NULL,
  "data_content" TEXT NOT NULL DEFAULT '{}'
);

INSERT OR IGNORE INTO "_sys_model_category"
  ("id", "code", "name", "order", "aggregate", "created_at", "updated_at", "data_content")
SELECT
  "id",
  "code",
  "name",
  "order",
  "aggregate",
  "created_at",
  "updated_at",
  "data_content"
FROM "_sys_model_tab";
DROP TABLE "_sys_model_tab";

CREATE TABLE IF NOT EXISTS "_sys_user_roles" (
  "source_id"    TEXT NOT NULL,
  "target_value" TEXT NOT NULL,
  PRIMARY KEY ("source_id", "target_value")
);

DROP TABLE IF EXISTS "_sys_user_next";
CREATE TABLE "_sys_user_next" (
  "id"           TEXT PRIMARY KEY,
  "username"     TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "created_at"   INTEGER NOT NULL,
  "updated_at"   INTEGER NOT NULL,
  "data_content" TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO "_sys_user_next"
  ("id", "username", "passwordHash", "created_at", "updated_at", "data_content")
SELECT
  "id",
  "username",
  COALESCE("passwordHash", ''),
  "created_at",
  "updated_at",
  json_remove(
    COALESCE("data_content", '{}'),
    '$.gender',
    '$.city',
    '$.remark',
    '$.nickname',
    '$.createBy',
    '$.super'
  )
FROM "_sys_user";
DROP TABLE "_sys_user";
ALTER TABLE "_sys_user_next" RENAME TO "_sys_user";

DROP TABLE IF EXISTS "_sys_role_next";
CREATE TABLE "_sys_role_next" (
  "id"           TEXT PRIMARY KEY,
  "code"         TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "parentId"     TEXT,
  "created_at"   INTEGER NOT NULL,
  "updated_at"   INTEGER NOT NULL,
  "data_content" TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO "_sys_role_next"
  ("id", "code", "name", "parentId", "created_at", "updated_at", "data_content")
SELECT
  "id",
  "code",
  "name",
  "parentId",
  "created_at",
  "updated_at",
  json_remove(COALESCE("data_content", '{}'), '$.description')
FROM "_sys_role";
DROP TABLE "_sys_role";
ALTER TABLE "_sys_role_next" RENAME TO "_sys_role";

DROP TABLE IF EXISTS "_sys_model_category_next";
CREATE TABLE "_sys_model_category_next" (
  "id"           TEXT PRIMARY KEY,
  "code"         TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "order"        INTEGER NOT NULL DEFAULT 0,
  "aggregate"    INTEGER NOT NULL DEFAULT 0,
  "created_at"   INTEGER NOT NULL,
  "updated_at"   INTEGER NOT NULL,
  "data_content" TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO "_sys_model_category_next"
  ("id", "code", "name", "order", "aggregate", "created_at", "updated_at", "data_content")
SELECT
  "id",
  "code",
  "name",
  "order",
  "aggregate",
  "created_at",
  "updated_at",
  json_remove(COALESCE("data_content", '{}'), '$.description')
FROM "_sys_model_category";
DROP TABLE "_sys_model_category";
ALTER TABLE "_sys_model_category_next" RENAME TO "_sys_model_category";

CREATE UNIQUE INDEX "uidx__sys_user_username" ON "_sys_user" ("username");
CREATE UNIQUE INDEX "uidx__sys_role_code" ON "_sys_role" ("code");
CREATE INDEX "idx__sys_role_name" ON "_sys_role" ("name");
CREATE INDEX "idx__sys_role_parentId" ON "_sys_role" ("parentId");
CREATE UNIQUE INDEX "uidx__sys_model_category_code" ON "_sys_model_category" ("code");
CREATE INDEX "idx__sys_model_category_name" ON "_sys_model_category" ("name");
CREATE INDEX "idx__sys_model_category_order" ON "_sys_model_category" ("order");
CREATE INDEX IF NOT EXISTS "idx__sys_user_roles_target" ON "_sys_user_roles" ("target_value");

DELETE FROM "models"
WHERE "name" IN ('_sys_user', '_sys_role', '_sys_model_category', '_sys_model_tab');
