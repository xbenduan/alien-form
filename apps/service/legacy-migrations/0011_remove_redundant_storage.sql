CREATE TABLE "models_next" (
  "name"       TEXT PRIMARY KEY,
  "version"    INTEGER NOT NULL,
  "schema"     TEXT NOT NULL,
  "created_at" INTEGER NOT NULL,
  "updated_at" INTEGER NOT NULL
);

INSERT INTO "models_next" ("name", "version", "schema", "created_at", "updated_at")
SELECT "name", "version", "schema", "created_at", "updated_at"
FROM "models";

DROP TABLE "models";
ALTER TABLE "models_next" RENAME TO "models";

CREATE TABLE "sessions_next" (
  "token"   TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL
);

INSERT INTO "sessions_next" ("token", "user_id")
SELECT "token", "user_id"
FROM "sessions";

DROP TABLE "sessions";
ALTER TABLE "sessions_next" RENAME TO "sessions";

DROP TABLE "_sequences";
