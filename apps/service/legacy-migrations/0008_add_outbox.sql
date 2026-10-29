CREATE TABLE "_outbox" (
  "id"           TEXT PRIMARY KEY,
  "model"        TEXT NOT NULL,
  "topic"        TEXT NOT NULL,
  "payload"      TEXT NOT NULL,
  "occurred_at"  INTEGER NOT NULL,
  "processed_at" INTEGER,
  "attempts"     INTEGER NOT NULL DEFAULT 0,
  "last_error"   TEXT
);

CREATE INDEX "idx_outbox_pending"
ON "_outbox" ("processed_at", "occurred_at");
