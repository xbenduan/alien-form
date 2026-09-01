-- Alien Form Cloudflare Worker 后端的 D1 初始表结构。
--
-- 设计对齐用户要求：不做「一模型一物理表」，而是用两张通用表承载所有模型：
--   * schemas  —— 模型配置态 schema（等价于 Node 版 _schemas 元表）
--   * records  —— 所有模型的记录；系统字段单独成列，其余字段收进 data_content JSON
-- 另加 sessions 表：Worker 无内存态，登录会话必须落库才能跨请求 / 跨实例存活。

-- 模型配置态 schema：一模型一行，schema 原样存 JSON 文本。
CREATE TABLE IF NOT EXISTS "schemas" (
  "name"       TEXT PRIMARY KEY,
  "schema"     TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

-- 记录通用表：
--   系统字段（id / model / created_at / updated_at）独立成列，可直接索引、排序、过滤；
--   其余业务字段（含 many-to-many 关系数组）全部塞进 data_content JSON，
--   过滤 / 排序通过 SQLite 的 json_extract(data_content, '$.field') 在应用层白名单驱动。
CREATE TABLE IF NOT EXISTS "records" (
  "id"           TEXT NOT NULL,
  "model"        TEXT NOT NULL,
  "created_at"   INTEGER NOT NULL,
  "updated_at"   INTEGER NOT NULL,
  "data_content" TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY ("model", "id")
);

-- 按模型 + 更新时间倒序列表是最高频访问路径。
CREATE INDEX IF NOT EXISTS "idx_records_model_updated"
  ON "records" ("model", "updated_at" DESC);

-- 登录会话：token 主键，落库以跨无状态请求存活。
CREATE TABLE IF NOT EXISTS "sessions" (
  "token"      TEXT PRIMARY KEY,
  "user_id"    TEXT NOT NULL,
  "provider"   TEXT NOT NULL,
  "created_at" INTEGER NOT NULL
);
