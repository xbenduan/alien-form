import { refFields, type RefField } from "../domain/field-plan.ts";
import { isPluginMarker } from "@alien-form/validate";
import type { ModelRecord, BuilderSchema as ModelSchema } from "@alien-form/validate";
import type { SchemaStore } from "./schema-store.ts";

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

/** 字段 → 目标记录里的取值表达式（系统字段直取列，其余走 json_extract）。 */
function fieldExpr(field: string): string {
  if (field === "id") return `"id"`;
  if (field === "createdAt") return `"created_at"`;
  if (field === "updatedAt") return `"updated_at"`;
  return `json_extract(data_content, '$.${field}')`;
}

function toRef(ref: RefField, raw: unknown, labels: Map<string, string>): RefValue {
  return { $ref: ref.model, value: raw, label: labels.get(String(raw)) ?? String(raw) };
}

/** 把可能是 ref 对象的值拍回标量 join 键（写路径 / filters）。 */
export function unwrapRefValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(unwrapRefValue);
  if (isRefValue(value)) return value.value;
  return value;
}

export function unwrapRefs(
  values: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!values) return values;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) result[key] = unwrapRefValue(value);
  return result;
}

/**
 * 引用展开器：把记录里的引用字段（标量 join 键）替换为 { $ref, value, label }。
 * 依赖 SchemaStore 解析目标模型、直接查 records 表批量取 label（避免 N+1）。
 */
export class RefExpander {
  constructor(
    private readonly db: D1Database,
    private readonly schemas: SchemaStore,
  ) {}

  /** 批量取目标模型的 value → label 映射：一次 IN 查询。 */
  private async queryLabelMap(
    targetSchema: ModelSchema,
    valueKey: string,
    labelKey: string,
    values: unknown[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (values.length === 0) return map;
    const valueExpr = fieldExpr(valueKey);
    const labelExpr = fieldExpr(labelKey);
    const placeholders = values.map(() => "?").join(", ");
    const { results } = await this.db
      .prepare(
        `SELECT ${valueExpr} AS v, ${labelExpr} AS l FROM "records" ` +
          `WHERE "model" = ? AND ${valueExpr} IN (${placeholders})`,
      )
      .bind(targetSchema.meta.name, ...(values as Array<string | number>))
      .all<{ v: unknown; l: unknown }>();
    for (const row of results) {
      if (nonEmpty(row.v)) map.set(String(row.v), String(row.l ?? row.v));
    }
    return map;
  }

  /**
   * 读路径展开：把一批记录里的引用字段替换为 ref 对象。
   * 每个引用字段每页仅 1 条 IN 查询；many-to-many / 多值展开为 ref 对象数组。
   */
  async expand(schema: ModelSchema, records: ModelRecord[]): Promise<ModelRecord[]> {
    const refs = refFields(schema);
    if (refs.length === 0 || records.length === 0) return records;

    for (const ref of refs) {
      const targetSchema = await this.schemas.get(ref.model);
      if (!targetSchema) continue;

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

      const labels = await this.queryLabelMap(targetSchema, ref.valueKey, ref.labelKey, [...keys]);

      for (const record of records) {
        const value = record[ref.field];
        if (ref.multi && Array.isArray(value)) {
          record[ref.field] = value.map((item) => (nonEmpty(item) ? toRef(ref, item, labels) : item));
        } else if (nonEmpty(value)) {
          record[ref.field] = toRef(ref, value, labels);
        }
      }
    }
    return records;
  }

  async expandOne(schema: ModelSchema, record: ModelRecord): Promise<ModelRecord> {
    return (await this.expand(schema, [record]))[0];
  }
}
