import type { BuilderSchema as ModelSchema } from "@alien-form/validate";

/** schemas 元表的一行。 */
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

/**
 * 模型配置态仓储：schemas 元表的读写收口。
 * 一模型一行，schema 原样存 JSON 文本。
 */
export class SchemaStore {
  constructor(private readonly db: D1Database) {}

  async list(): Promise<SchemaEntry[]> {
    const { results } = await this.db
      .prepare(`SELECT schema, created_at, updated_at FROM "schemas" ORDER BY updated_at DESC`)
      .all<SchemaRow>();
    return results.map(parseRow);
  }

  async getEntry(name: string): Promise<SchemaEntry | undefined> {
    const row = await this.db
      .prepare(`SELECT schema, created_at, updated_at FROM "schemas" WHERE name = ?`)
      .bind(name)
      .first<SchemaRow>();
    return row ? parseRow(row) : undefined;
  }

  async get(name: string): Promise<ModelSchema | undefined> {
    return (await this.getEntry(name))?.schema;
  }

  async has(name: string): Promise<boolean> {
    const row = await this.db.prepare(`SELECT 1 FROM "schemas" WHERE name = ?`).bind(name).first();
    return Boolean(row);
  }

  /** upsert schema（保留首次 created_at）。 */
  async upsert(schema: ModelSchema): Promise<SchemaEntry> {
    const now = new Date().toISOString();
    const previous = await this.getEntry(schema.meta.name);
    const createdAt = previous?.createdAt ?? now;
    await this.db
      .prepare(
        `INSERT INTO "schemas" (name, schema, created_at, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET schema = excluded.schema, updated_at = excluded.updated_at`,
      )
      .bind(schema.meta.name, JSON.stringify(schema), createdAt, now)
      .run();
    return { schema, createdAt, updatedAt: now };
  }

  async remove(name: string): Promise<void> {
    await this.db.prepare(`DELETE FROM "schemas" WHERE name = ?`).bind(name).run();
  }
}
