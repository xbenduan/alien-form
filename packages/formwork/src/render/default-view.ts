import { escapePointer } from "../model/pointer";
import type { DataSchema, ViewNode } from "../model/types";
import type { RuntimeFieldDefinition } from "../model/types";
import { orderedProperties } from "../model/presentation";

export function defaultView(field = ""): ViewNode {
  return { field };
}
export function objectChildren(
  schema: DataSchema,
  root: DataSchema,
  fields?: Readonly<Record<string, RuntimeFieldDefinition>>,
  pointer = "",
): readonly ViewNode[] {
  return orderedProperties(schema, root, fields, pointer).map(([name]) =>
    defaultView(`/${escapePointer(name)}`),
  );
}
