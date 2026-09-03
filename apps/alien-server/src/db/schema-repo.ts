import { getDb } from "./connection.ts";
import type { ModelSchema } from "../schema/types.ts";

/** 元表：存储所有模型的配置态 schema（JSON）+ 时间戳。 */
export function ensureSchemaTable(): void {
  const db = getDb();
  db.exec(
    `CREATE TABLE IF NOT EXISTS "_schemas" (
      "name" TEXT PRIMARY KEY,
      "schema" TEXT NOT NULL,
      "created_at" TEXT NOT NULL,
      "updated_at" TEXT NOT NULL
    )`,
  );
  // 记录主键自增序列：每模型一行，next 为最近已分配序号（配合 record-repo.nextId）。
  db.exec(
    `CREATE TABLE IF NOT EXISTS "_sequences" (
      "model" TEXT PRIMARY KEY,
      "next" INTEGER NOT NULL
    )`,
  );
}

export interface SchemaEntry {
  schema: ModelSchema;
  createdAt: string;
  updatedAt: string;
}

function parseRow(row: { schema: string; created_at: string; updated_at: string }): SchemaEntry {
  return {
    schema: JSON.parse(row.schema) as ModelSchema,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listSchemas(): SchemaEntry[] {
  const rows = getDb()
    .prepare(`SELECT schema, created_at, updated_at FROM "_schemas" ORDER BY updated_at DESC`)
    .all() as Array<{ schema: string; created_at: string; updated_at: string }>;
  return rows.map(parseRow);
}

export function getSchemaEntry(name: string): SchemaEntry | undefined {
  const row = getDb()
    .prepare(`SELECT schema, created_at, updated_at FROM "_schemas" WHERE name = ?`)
    .get(name) as { schema: string; created_at: string; updated_at: string } | undefined;
  return row ? parseRow(row) : undefined;
}

export function getSchema(name: string): ModelSchema | undefined {
  return getSchemaEntry(name)?.schema;
}

export function hasSchema(name: string): boolean {
  const row = getDb().prepare(`SELECT 1 FROM "_schemas" WHERE name = ?`).get(name);
  return Boolean(row);
}

/** upsert schema（保留首次 created_at）。 */
export function upsertSchema(schema: ModelSchema): SchemaEntry {
  const db = getDb();
  const now = new Date().toISOString();
  const previous = getSchemaEntry(schema.meta.name);
  const createdAt = previous?.createdAt ?? now;
  db.prepare(
    `INSERT INTO "_schemas" (name, schema, created_at, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET schema = excluded.schema, updated_at = excluded.updated_at`,
  ).run(schema.meta.name, JSON.stringify(schema), createdAt, now);
  return { schema, createdAt, updatedAt: now };
}

export function removeSchema(name: string): void {
  getDb().prepare(`DELETE FROM "_schemas" WHERE name = ?`).run(name);
}
