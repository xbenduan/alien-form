import { escapePointer } from "../model/pointer";
import { resolveSchema, schemaType } from "../model/validation";
import type { DataSchema, ViewNode } from "../model/types";

export function componentFor(schema: DataSchema): string {
  if ("enum" in schema && schema.enum) return "Select";
  return ({ string: "Input", number: "NumberInput", integer: "NumberInput", boolean: "Switch", object: "Object", array: "Array", null: "Null" } as Record<string, string>)[schemaType(schema)]!;
}
export function defaultView(schema: DataSchema, root = schema, field = ""): ViewNode {
  schema = resolveSchema(schema, root);
  return { component: componentFor(schema), field };
}
export function objectChildren(schema: DataSchema, root: DataSchema): readonly ViewNode[] {
  schema = resolveSchema(schema, root);
  return "properties" in schema ? Object.entries(schema.properties).map(([name, child]) => defaultView(child, root, `/${escapePointer(name)}`)) : [];
}
