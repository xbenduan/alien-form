import type { DatabaseColumnType, ModelFieldSchema, ModelSchema } from "@alien-form/protocol";
import { quoteColumn } from "./sql.ts";

export interface FieldPlan {
  field: string;
  type: DatabaseColumnType;
  storage: "physical" | "virtual";
  column?: string;
  json: boolean;
  filterable: boolean;
  sortable: boolean;
}

export interface RefField {
  field: string;
  model: string;
  valueKey: string;
  labelKey: string;
  multi: boolean;
}

export function columnName(field: ModelFieldSchema): string {
  if (field.key === "createdAt") return "created_at";
  if (field.key === "updatedAt") return "updated_at";
  return field.storage?.column ?? field.key;
}

function inferredType(field: ModelFieldSchema): DatabaseColumnType {
  if (field.storage) return field.storage.type;
  if (field.type === "number") return "real";
  if (field.type === "boolean") return "boolean";
  if (field.type === "object" || field.type === "array") return "json";
  return "text";
}

export function planFields(schema: ModelSchema): FieldPlan[] {
  return schema.fields
    .filter((field) => field.relation?.kind !== "many-to-many")
    .map((field) => {
      const type = inferredType(field);
      const json = type === "json";
      return {
        field: field.key,
        type,
        storage: field.storage ? "physical" : "virtual",
        column: field.storage ? columnName(field) : undefined,
        json,
        filterable: field.filter?.hidden !== true && !json,
        sortable: !json,
      };
    });
}

export function planByField(schema: ModelSchema): Map<string, FieldPlan> {
  return new Map(planFields(schema).map((plan) => [plan.field, plan]));
}

export function fieldExpression(plan: FieldPlan): string {
  if (plan.storage === "physical" && plan.column) return quoteColumn(plan.column);
  return `json_extract("data_content", '$.${plan.field}')`;
}

export function modelField(schema: ModelSchema, key: string): ModelFieldSchema | undefined {
  return schema.fields.find((field) => field.key === key);
}

export function refFields(schema: ModelSchema): RefField[] {
  return schema.fields.flatMap((field) => {
    const relation = field.relation;
    if (!relation) return [];
    return [
      {
        field: field.key,
        model: relation.target,
        valueKey: relation.valueField ?? "id",
        labelKey: relation.labelField ?? "name",
        multi: relation.kind === "many-to-many" || field.type === "array",
      },
    ];
  });
}
