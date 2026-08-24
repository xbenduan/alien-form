import type { ColumnType, ModelSchema } from "./types.ts";
import type { ColumnPlan } from "./field-plan.ts";
import { planFields } from "./field-plan.ts";
import { tableName } from "./naming.ts";

/** ColumnType → SQLite 存储类别。 */
function sqliteType(type: ColumnType): string {
  switch (type) {
    case "integer":
    case "boolean":
      return "INTEGER";
    case "real":
      return "REAL";
    // text / json 都是 TEXT
    default:
      return "TEXT";
  }
}

function defaultLiteral(value: string | number | boolean): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${value.replace(/'/g, "''")}'`;
}

export function buildColumnDDL(plan: ColumnPlan): string {
  const parts = [`"${plan.column}"`, sqliteType(plan.type)];
  if (!plan.nullable) parts.push("NOT NULL");
  if (plan.unique) parts.push("UNIQUE");
  if (plan.default !== undefined) parts.push(`DEFAULT ${defaultLiteral(plan.default)}`);
  return parts.join(" ");
}

/**
 * 一份 schema → 建表 DDL（幂等）：
 *  - 主表：系统列 id/created_at/updated_at + 各 ColumnPlan 列（many-to-one 附外键约束）
 *  - 索引：index 为 true 的列
 *  - junction 表：每个 m2m 关系一张
 */
export function buildTableDDL(schema: ModelSchema): string[] {
  const table = tableName(schema.meta.name);
  const plans = planFields(schema);
  const statements: string[] = [];

  const columns: string[] = [
    `"id" TEXT PRIMARY KEY`,
    `"created_at" INTEGER`,
    `"updated_at" INTEGER`,
  ];
  const foreignKeys: string[] = [];

  for (const plan of plans) {
    if (plan.kind !== "column") continue;
    columns.push(buildColumnDDL(plan));
    if (plan.relationTarget) {
      foreignKeys.push(
        `FOREIGN KEY ("${plan.column}") REFERENCES "${tableName(plan.relationTarget)}"("id")`,
      );
    }
  }

  const body = [...columns, ...foreignKeys].join(",\n  ");
  statements.push(`CREATE TABLE IF NOT EXISTS "${table}" (\n  ${body}\n)`);

  // 索引
  for (const plan of plans) {
    if (plan.kind === "column" && plan.index) {
      statements.push(
        `CREATE INDEX IF NOT EXISTS "idx_${table}_${plan.column}" ON "${table}"("${plan.column}")`,
      );
    }
  }

  // junction 表
  for (const plan of plans) {
    if (plan.kind !== "m2m") continue;
    statements.push(
      `CREATE TABLE IF NOT EXISTS "${plan.through}" (\n` +
        `  "${plan.ownerColumn}" TEXT NOT NULL,\n` +
        `  "${plan.targetColumn}" TEXT NOT NULL,\n` +
        `  PRIMARY KEY ("${plan.ownerColumn}", "${plan.targetColumn}")\n` +
        `)`,
    );
  }

  return statements;
}
