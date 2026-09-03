-- 记录主键自增序列：每个模型一行，next 为下一个待分配的序号。
-- id 格式为 MDM + 10 位零填充（如 MDM0000000001），按模型独立自增。
-- 取号用单条原子语句 INSERT ... ON CONFLICT DO UPDATE ... RETURNING，
-- 依赖 D1 写入串行化保证并发下不重号。
CREATE TABLE IF NOT EXISTS "_sequences" (
  "model" TEXT PRIMARY KEY,
  "next"  INTEGER NOT NULL
);
