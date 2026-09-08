import { isPluginMarker, type ModelRecord, type ModelSchema } from "@alien-form/protocol";
import { fieldExpression, planByField, refFields, type RefField } from "../domain/field-plan.ts";
import { quoteTable } from "../domain/sql.ts";
import type { ModelStore } from "./model-store.ts";

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

function toRef(ref: RefField, raw: unknown, labels: Map<string, string>): RefValue {
  return { $ref: ref.model, value: raw, label: labels.get(String(raw)) ?? String(raw) };
}

export function unwrapRefValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(unwrapRefValue);
  if (isRefValue(value)) return value.value;
  return value;
}

export function unwrapRefs(
  values: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!values) return values;
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, unwrapRefValue(value)]),
  );
}

export class RefExpander {
  constructor(
    private readonly db: D1Database,
    private readonly models: ModelStore,
  ) {}

  private async queryLabelMap(
    target: ModelSchema,
    valueKey: string,
    labelKey: string,
    values: unknown[],
  ): Promise<Map<string, string>> {
    const fields = planByField(target);
    const valuePlan = fields.get(valueKey);
    const labelPlan = fields.get(labelKey);
    if (!valuePlan || !labelPlan || values.length === 0) return new Map();
    const valueExpr = fieldExpression(valuePlan);
    const labelExpr = fieldExpression(labelPlan);
    const { results } = await this.db
      .prepare(
        `SELECT ${valueExpr} AS v, ${labelExpr} AS l
         FROM ${quoteTable(target.name)}
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

  async expand(schema: ModelSchema, records: ModelRecord[]): Promise<ModelRecord[]> {
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

  async expandOne(schema: ModelSchema, record: ModelRecord): Promise<ModelRecord> {
    return (await this.expand(schema, [record]))[0];
  }
}
