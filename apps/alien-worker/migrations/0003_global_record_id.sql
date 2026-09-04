-- 记录主键从 (model, id) 复合主键收敛为 id 单列全局唯一。
--
-- 背景：所有模型的记录共用一张 records 表。原设计 id 仅在模型内唯一，靠
-- _sequences 按 model 各自自增；现改为「跨模型全局唯一自增」——一个全局计数器，
-- id 单列即主键，model 降为普通索引列（列表查询仍走 idx_records_model_updated）。
--
-- SQLite 无法 ALTER 主键，故重建表并迁移数据。

-- 1) 重建 records：id 单主键，model 保留为普通列。
CREATE TABLE "records_new" (
  "id"           TEXT PRIMARY KEY,
  "model"        TEXT NOT NULL,
  "created_at"   INTEGER NOT NULL,
  "updated_at"   INTEGER NOT NULL,
  "data_content" TEXT NOT NULL DEFAULT '{}'
);

-- 2) 迁移存量数据。若历史上不同模型存在同名 id，INSERT OR IGNORE 只保留首条，
--    避免主键冲突（本地 demo 场景一般不会命中）。
INSERT OR IGNORE INTO "records_new" (id, model, created_at, updated_at, data_content)
  SELECT id, model, created_at, updated_at, data_content FROM "records";

DROP TABLE "records";
ALTER TABLE "records_new" RENAME TO "records";

-- 3) 高频访问路径：按模型 + 更新时间倒序列表。
CREATE INDEX IF NOT EXISTS "idx_records_model_updated"
  ON "records" ("model", "updated_at" DESC);

-- 4) _sequences 归拢为单个全局计数器。next 记录「最近已分配序号」。
--    种子取存量 records 里的最大序号（去前缀转整数），保证不与既有 id 撞号。
DELETE FROM "_sequences";
INSERT INTO "_sequences" (model, next)
  VALUES (
    '__global__',
    COALESCE((SELECT MAX(CAST(SUBSTR(id, 4) AS INTEGER)) FROM "records" WHERE id LIKE 'MDM%'), 0)
  );
