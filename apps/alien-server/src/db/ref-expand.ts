import { getDb } from "./connection.ts";
import { getSchema } from "./schema-repo.ts";
import { planByField, refFields } from "../schema/field-plan.ts";
import type { RefField } from "../schema/field-plan.ts";
import { tableName, toSnake } from "../schema/naming.ts";
import { isPluginMarker } from "../schema/types.ts";
import type { ModelRecord, ModelSchema } from "../schema/types.ts";

/** 引用字段展开后的形状：value 为 join 键原值（回写用），label 为展示名。 */
export interface RefValue {
  $ref: string;
  value: unknown;
  label: string;
}

function isRefValue(value: unknown): value is RefValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !isPluginMarker(value) &&
    "$ref" in value &&
    "value" in value
  );
}

function nonEmpty(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

/** 字段名 → 目标表物理列名（系统字段直取，其余走列计划）。 */
function columnOf(schema: ModelSchema, field: string): string | undefined {
  if (field === "id") return "id";
  if (field === "createdAt") return "created_at";
  if (field === "updatedAt") return "updated_at";
  const plan = planByField(schema).get(field);
  if (plan && plan.kind === "column") return plan.column;
  // 兜底：按命名规则推导（不在列计划里的字段一般不该作 join 键）
  return toSnake(field);
}

/**
 * 批量取目标模型的 value → label 映射：一次 IN 查询，避免 N+1。
 * 悬空引用（目标已删）不会进 map，调用方回落到 value 本身。
 */
function queryLabelMap(
  targetSchema: ModelSchema,
  valueKey: string,
  labelKey: string,
  values: unknown[],
): Map<string, string> {
  const map = new Map<string, string>();
  if (values.length === 0) return map;
  const valueCol = columnOf(targetSchema, valueKey);
  const labelCol = columnOf(targetSchema, labelKey);
  if (!valueCol || !labelCol) return map;

  const db = getDb();
  const table = tableName(targetSchema.meta.name);
  const placeholders = values.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT "${valueCol}" AS v, "${labelCol}" AS l FROM "${table}" WHERE "${valueCol}" IN (${placeholders})`,
    )
    .all(...(values as Array<string | number>)) as Array<{ v: unknown; l: unknown }>;
  for (const row of rows) {
    if (nonEmpty(row.v)) map.set(String(row.v), String(row.l ?? row.v));
  }
  return map;
}

/** 把一个标量 join 键包成 ref 对象（label 缺失回落到原值）。 */
function toRef(ref: RefField, raw: unknown, labels: Map<string, string>): RefValue {
  return { $ref: ref.model, value: raw, label: labels.get(String(raw)) ?? String(raw) };
}

/**
 * 读路径展开：把一批记录里的引用字段（标量 join 键）替换为 { $ref, value, label }。
 * 原地修改传入记录数组的浅拷贝键，返回同一数组引用。
 *  - 每个引用字段每页仅 1 条 IN 查询。
 *  - many-to-many / 多值：值为数组，逐项展开为 ref 对象数组。
 */
export function expandRefs(schema: ModelSchema, records: ModelRecord[]): ModelRecord[] {
  const refs = refFields(schema);
  if (refs.length === 0 || records.length === 0) return records;

  for (const ref of refs) {
    const targetSchema = getSchema(ref.model);
    if (!targetSchema) continue;

    // 收集本字段所有非空 join 键（多值字段拍平），去重后一次查询
    const keys = new Set<unknown>();
    for (const record of records) {
      const value = record[ref.field];
      if (ref.multi && Array.isArray(value)) {
        for (const item of value) if (nonEmpty(item)) keys.add(item);
      } else if (nonEmpty(value)) {
        keys.add(value);
      }
    }
    if (keys.size === 0) continue;

    const labels = queryLabelMap(targetSchema, ref.valueKey, ref.labelKey, [...keys]);

    for (const record of records) {
      const value = record[ref.field];
      if (ref.multi && Array.isArray(value)) {
        record[ref.field] = value.map((item) =>
          nonEmpty(item) ? toRef(ref, item, labels) : item,
        );
      } else if (nonEmpty(value)) {
        record[ref.field] = toRef(ref, value, labels);
      }
    }
  }
  return records;
}

/** 单条记录展开（复用批量实现）。 */
export function expandRefsOne(schema: ModelSchema, record: ModelRecord): ModelRecord {
  return expandRefs(schema, [record])[0];
}

/** 把可能是 ref 对象的值拍回标量 join 键（写路径 / filters）。 */
export function unwrapRefValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(unwrapRefValue);
  if (isRefValue(value)) return value.value;
  return value;
}

/** 写路径：逐值 unwrap，使前端提交标量或 ref 对象都能被消化。 */
export function unwrapRefs(
  values: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!values) return values;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) result[key] = unwrapRefValue(value);
  return result;
}
