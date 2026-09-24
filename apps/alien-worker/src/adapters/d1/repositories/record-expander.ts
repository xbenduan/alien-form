import type { ModelRecord, AlienSchema } from "@alien-form/protocol";
import type { CompiledModelProvider, RecordExpander } from "@alien-form/alienbase";
import { fieldExpression, refFields, type RefField } from "../compiler/field-plan.ts";
import { quoteTable } from "../compiler/sql.ts";

interface RefValue {
  $ref: string;
  value: unknown;
  label: string;
}

function nonEmpty(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function toRef(ref: RefField, raw: unknown, labels: Map<string, string>): RefValue {
  return { $ref: ref.model, value: raw, label: labels.get(String(raw)) ?? String(raw) };
}

/** AlienBase 引用展开端口的 D1 实现。 */
export class D1RecordExpander implements RecordExpander {
  constructor(
    private readonly db: D1Database,
    private readonly models: CompiledModelProvider,
  ) {}

  private async queryLabelMap(
    target: Awaited<ReturnType<CompiledModelProvider["require"]>>,
    valueKey: string,
    labelKey: string,
    values: unknown[],
  ): Promise<Map<string, string>> {
    const valuePlan = target.query.fields.get(valueKey);
    const labelPlan = target.query.fields.get(labelKey);
    if (!valuePlan || !labelPlan || values.length === 0) return new Map();
    const valueExpr = fieldExpression(valuePlan);
    const labelExpr = fieldExpression(labelPlan);
    const { results } = await this.db
      .prepare(
        `SELECT ${valueExpr} AS v, ${labelExpr} AS l
         FROM ${quoteTable(target.schema.name)}
         WHERE ${valueExpr} IN (${values.map(() => "?").join(", ")})`,
      )
      .bind(...(values as Array<string | number>))
      .all<{ v: unknown; l: unknown }>();
    return new Map(
      results.flatMap((row) =>
        nonEmpty(row.v) ? [[String(row.v), String(row.l ?? row.v)] as const] : [],
      ),
    );
  }

  async expand(schema: AlienSchema, records: ModelRecord[]): Promise<ModelRecord[]> {
    if (records.length === 0) return records;
    for (const ref of refFields(schema)) {
      const target = await this.models.get(ref.model);
      if (!target) continue;
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
      const labels = await this.queryLabelMap(target, ref.valueKey, ref.labelKey, [...keys]);
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

  async expandOne(schema: AlienSchema, record: ModelRecord): Promise<ModelRecord> {
    return (await this.expand(schema, [record]))[0];
  }
}
