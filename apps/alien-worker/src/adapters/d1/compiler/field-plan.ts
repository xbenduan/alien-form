import type { AlienSchema } from "@alien-form/protocol";
import type { CompiledFieldPlan } from "@alien-form/alienbase";
import { quoteColumn } from "./sql.ts";

export type FieldPlan = CompiledFieldPlan;

export interface RefField {
  field: string;
  model: string;
  valueKey: string;
  labelKey: string;
  multi: boolean;
}

export function columnName(field: AlienSchema["fields"][number]): string {
  if (field.key === "createdAt") return "created_at";
  if (field.key === "updatedAt") return "updated_at";
  return field.storage?.column ?? field.key;
}

function inferredType(
  field: AlienSchema["fields"][number],
): NonNullable<AlienSchema["fields"][number]["storage"]>["type"] {
  if (field.storage) return field.storage.type;
  if (field.type === "number") return "real";
  if (field.type === "boolean") return "boolean";
  if (field.type === "object" || field.type === "array") return "json";
  return "text";
}

export function planFields(schema: AlienSchema): FieldPlan[] {
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

export function planByField(schema: AlienSchema): Map<string, FieldPlan> {
  return new Map(planFields(schema).map((plan) => [plan.field, plan]));
}

export function fieldExpression(plan: FieldPlan): string {
  if (plan.storage === "physical" && plan.column) return quoteColumn(plan.column);
  return `json_extract("data_content", '$.${plan.field}')`;
}

export function modelField(
  schema: AlienSchema,
  key: string,
): AlienSchema["fields"][number] | undefined {
  return schema.fields.find((field) => field.key === key);
}

export function refFields(schema: AlienSchema): RefField[] {
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
