import type { BuilderSchema as ModelSchema } from "@alien-form/validate";

/** schemas 元表的一行（等价于 Node 版 _schemas）。 */
export interface SchemaEntry {
  schema: ModelSchema;
  createdAt: string;
  updatedAt: string;
}

interface SchemaRow {
  schema: string;
  created_at: string;
  updated_at: string;
}

function parseRow(row: SchemaRow): SchemaEntry {
  return {
    schema: JSON.parse(row.schema) as ModelSchema,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSchemas(db: D1Database): Promise<SchemaEntry[]> {
  const { results } = await db
    .prepare(`SELECT schema, created_at, updated_at FROM "schemas" ORDER BY updated_at DESC`)
    .all<SchemaRow>();
  return results.map(parseRow);
}

export async function getSchemaEntry(
  db: D1Database,
  name: string,
): Promise<SchemaEntry | undefined> {
  const row = await db
    .prepare(`SELECT schema, created_at, updated_at FROM "schemas" WHERE name = ?`)
    .bind(name)
    .first<SchemaRow>();
  return row ? parseRow(row) : undefined;
}

export async function getSchema(db: D1Database, name: string): Promise<ModelSchema | undefined> {
  return (await getSchemaEntry(db, name))?.schema;
}

export async function hasSchema(db: D1Database, name: string): Promise<boolean> {
  const row = await db.prepare(`SELECT 1 FROM "schemas" WHERE name = ?`).bind(name).first();
  return Boolean(row);
}

/** upsert schema（保留首次 created_at）。 */
export async function upsertSchema(db: D1Database, schema: ModelSchema): Promise<SchemaEntry> {
  const now = new Date().toISOString();
  const previous = await getSchemaEntry(db, schema.meta.name);
  const createdAt = previous?.createdAt ?? now;
  await db
    .prepare(
      `INSERT INTO "schemas" (name, schema, created_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET schema = excluded.schema, updated_at = excluded.updated_at`,
    )
    .bind(schema.meta.name, JSON.stringify(schema), createdAt, now)
    .run();
  return { schema, createdAt, updatedAt: now };
}

export async function removeSchema(db: D1Database, name: string): Promise<void> {
  await db.prepare(`DELETE FROM "schemas" WHERE name = ?`).bind(name).run();
}
