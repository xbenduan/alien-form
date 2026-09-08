import {
  assertStorageCompatible,
  type DatabaseColumnType,
  type MigrationOperation,
  type MigrationPlan,
  type ModelFieldSchema,
  type ModelSchema,
  type StorageColumn,
  type StorageIndex,
  type StorageManifest,
  type StorageRelation,
} from "@alien-form/protocol";
import { quoteColumn, quoteTable, sqlString } from "./sql.ts";

const RESERVED_TABLES = new Set(["models", "sessions", "_sequences"]);

function physicalColumn(field: ModelFieldSchema): string {
  if (field.key === "createdAt") return "created_at";
  if (field.key === "updatedAt") return "updated_at";
  return field.database?.column ?? field.key;
}

function sqliteType(type: DatabaseColumnType): string {
  if (type === "integer" || type === "boolean" || type === "date") return "INTEGER";
  if (type === "real") return "REAL";
  return "TEXT";
}

function defaultSql(value: StorageColumn["default"]): string {
  if (value === null) return "NULL";
  if (typeof value === "string") return sqlString(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

function indexName(table: string, field: string, unique: boolean): string {
  return `${unique ? "uidx" : "idx"}_${table.replaceAll("-", "_")}_${field}`;
}

function columnDefinition(column: StorageColumn, creating: boolean): string {
  if (column.field === "id") return `${quoteColumn(column.column)} TEXT PRIMARY KEY`;
  const parts = [quoteColumn(column.column), sqliteType(column.type)];
  if (!column.nullable) parts.push("NOT NULL");
  if (column.default !== undefined) parts.push(`DEFAULT ${defaultSql(column.default)}`);
  if (!creating && !column.nullable && column.default === undefined) {
    throw new Error(`新增物理字段 ${column.field} 必须允许空值或提供默认值`);
  }
  return parts.join(" ");
}

function relationTableSql(relation: StorageRelation): string {
  const table = quoteTable(relation.table);
  return (
    `CREATE TABLE ${table} (` +
    `"source_id" TEXT NOT NULL, "target_value" TEXT NOT NULL, ` +
    `PRIMARY KEY ("source_id", "target_value")` +
    `)`
  );
}

export function compileStorageManifest(schema: ModelSchema): StorageManifest {
  if (RESERVED_TABLES.has(schema.name)) throw new Error(`模型名为系统保留表：${schema.name}`);

  const columns: StorageColumn[] = [];
  const indexes: StorageIndex[] = [];
  const relations: StorageRelation[] = [];

  for (const field of schema.fields) {
    if (field.storage === "physical" && field.relation?.kind === "many-to-many") {
      relations.push({
        field: field.key,
        table: field.relation.through ?? `${schema.name}_${field.key}`,
        relation: field.relation,
      });
      continue;
    }
    if (field.storage !== "physical" || !field.database) continue;
    const column: StorageColumn = {
      fieldId: field.id,
      field: field.key,
      column: physicalColumn(field),
      type: field.database.type,
      valueType: field.database.valueType,
      nullable: field.key === "id" ? false : (field.database.nullable ?? true),
      default: field.database.default,
      unique: field.key === "id" || (field.database.unique ?? false),
      index: field.database.index ?? false,
      system: field.database.system ?? false,
    };
    columns.push(column);
    if (field.key !== "id" && (column.index || column.unique)) {
      indexes.push({
        name: indexName(schema.name, field.key, column.unique),
        table: schema.name,
        columns: [column.column],
        unique: column.unique,
      });
    }
  }

  return {
    model: schema.name,
    table: schema.name,
    version: schema.version,
    columns,
    indexes,
    relations,
  };
}

function createTableOperation(manifest: StorageManifest): MigrationOperation {
  const columns = [
    ...manifest.columns.map((column) => columnDefinition(column, true)),
    `"data_content" TEXT NOT NULL DEFAULT '{}'`,
  ];
  return {
    kind: "create-table",
    sql: `CREATE TABLE ${quoteTable(manifest.table)} (${columns.join(", ")})`,
  };
}

function createIndexOperation(index: StorageIndex): MigrationOperation {
  return {
    kind: index.unique ? "add-unique-index" : "add-index",
    sql:
      `CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${quoteColumn(index.name)} ` +
      `ON ${quoteTable(index.table)} (${index.columns.map(quoteColumn).join(", ")})`,
  };
}

export function compileMigrationPlan(
  current: ModelSchema | undefined,
  incoming: ModelSchema,
): { manifest: StorageManifest; plan: MigrationPlan } {
  if (current) assertStorageCompatible(current, incoming);
  const manifest = compileStorageManifest(incoming);
  const operations: MigrationOperation[] = [];

  if (!current) {
    operations.push(createTableOperation(manifest));
    operations.push(...manifest.indexes.map(createIndexOperation));
    operations.push(
      ...manifest.relations.map((relation) => ({
        kind: "add-relation-table" as const,
        sql: relationTableSql(relation),
      })),
    );
  } else {
    const currentManifest = compileStorageManifest(current);
    const oldColumns = new Set(currentManifest.columns.map((column) => column.fieldId));
    const oldIndexes = new Set(currentManifest.indexes.map((index) => index.name));
    const oldRelations = new Set(currentManifest.relations.map((relation) => relation.field));

    operations.push(
      ...manifest.columns
        .filter((column) => !oldColumns.has(column.fieldId))
        .map((column) => ({
          kind: "add-column" as const,
          sql:
            `ALTER TABLE ${quoteTable(manifest.table)} ADD COLUMN ` +
            columnDefinition(column, false),
        })),
    );
    operations.push(
      ...manifest.indexes.filter((index) => !oldIndexes.has(index.name)).map(createIndexOperation),
    );
    operations.push(
      ...manifest.relations
        .filter((relation) => !oldRelations.has(relation.field))
        .map((relation) => ({
          kind: "add-relation-table" as const,
          sql: relationTableSql(relation),
        })),
    );
  }

  return {
    manifest,
    plan: {
      model: incoming.name,
      fromVersion: current?.version ?? 0,
      toVersion: incoming.version,
      operations,
    },
  };
}
