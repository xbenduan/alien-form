import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** 数据库文件路径：apps/alien-server/data/alien.db（相对本文件定位，避免 cwd 依赖）。 */
const DB_PATH = fileURLToPath(new URL("../../data/alien.db", import.meta.url));

let instance: DatabaseSync | undefined;

/** 单例连接。首次打开时设置 WAL / busy_timeout / 外键，缓解并发与竞争。 */
export function getDb(): DatabaseSync {
  if (instance) return instance;

  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  // WAL：读写并发更好；busy_timeout：写锁竞争时自动重试而非立刻报错；外键：级联/引用完整性
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  instance = db;
  return db;
}

/**
 * 事务包裹：多表写（主表 + junction）要么全成功要么全回滚。
 * DatabaseSync 是同步 API，这里用同步事务保证原子性。
 */
export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
