import {
  parseModelSchema,
  type MigrationPlan,
  type ModelSchema,
  type ModelSummary,
} from "@alien-form/protocol";

interface ModelRow {
  name: string;
  title: string;
  version: number;
  schema: string;
  updated_at: number;
}

export class ModelVersionConflictError extends Error {}

function parseRow(row: Pick<ModelRow, "schema">): ModelSchema {
  return parseModelSchema(JSON.parse(row.schema));
}

export class ModelStore {
  constructor(private readonly db: D1Database) {}

  async list(): Promise<ModelSummary[]> {
    const { results } = await this.db
      .prepare(
        `SELECT name, title, version, schema, updated_at
         FROM "models" ORDER BY updated_at DESC`,
      )
      .all<ModelRow>();
    return results.map((row) => {
      const model = parseRow(row);
      return {
        name: row.name,
        title: row.title,
        version: row.version,
        subtitle: model.subtitle,
        description: model.description,
        group: model.group,
        singularLabel: model.singularLabel,
        pluralLabel: model.pluralLabel,
        defaultPageSize: model.defaultPageSize,
        fieldCount: model.fields.length,
        updatedAt: new Date(row.updated_at).toISOString(),
      };
    });
  }

  async get(name: string): Promise<ModelSchema | undefined> {
    const row = await this.db
      .prepare(`SELECT schema FROM "models" WHERE name = ?`)
      .bind(name)
      .first<Pick<ModelRow, "schema">>();
    return row ? parseRow(row) : undefined;
  }

  async has(name: string): Promise<boolean> {
    return Boolean(
      await this.db.prepare(`SELECT 1 FROM "models" WHERE name = ?`).bind(name).first(),
    );
  }

  async publish(
    schema: ModelSchema,
    tableName: string,
    plan: MigrationPlan,
    expectedVersion: number,
  ): Promise<ModelSchema> {
    const now = Date.now();
    const statements = plan.operations.map((operation) => this.db.prepare(operation.sql));

    if (expectedVersion === 0) {
      statements.push(
        this.db
          .prepare(
            `INSERT INTO "models"
             (name, title, table_name, version, schema, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            schema.name,
            schema.title,
            tableName,
            schema.version,
            JSON.stringify(schema),
            now,
            now,
          ),
      );
    } else {
      statements.unshift(
        this.db
          .prepare(
            `INSERT INTO "models"
             (name, title, table_name, version, schema, created_at, updated_at)
             SELECT name, title, table_name, version, schema, created_at, updated_at
             FROM "models" WHERE name = ? AND version <> ?`,
          )
          .bind(schema.name, expectedVersion),
      );
      statements.push(
        this.db
          .prepare(
            `UPDATE "models"
             SET title = ?, version = ?, schema = ?, updated_at = ?
             WHERE name = ? AND version = ?`,
          )
          .bind(
            schema.title,
            schema.version,
            JSON.stringify(schema),
            now,
            schema.name,
            expectedVersion,
          ),
      );
    }

    let results: D1Result[];
    try {
      results = await this.db.batch(statements);
    } catch (reason) {
      if (expectedVersion > 0) {
        const row = await this.db
          .prepare(`SELECT version FROM "models" WHERE name = ?`)
          .bind(schema.name)
          .first<{ version: number }>();
        if (row?.version !== expectedVersion) {
          throw new ModelVersionConflictError(`模型版本冲突：${schema.name}`);
        }
      }
      throw reason;
    }
    const metadataResult = results.at(-1);
    if (expectedVersion > 0 && metadataResult?.meta.changes !== 1) {
      throw new ModelVersionConflictError(`模型版本冲突：${schema.name}`);
    }
    return schema;
  }
}
