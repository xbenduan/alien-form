/** Schema-level pure helpers. */

import type { IFieldSchema } from "../types";

export function getArrayItemSchema(schema: IFieldSchema): IFieldSchema | null {
  if (schema.type !== "array") return null;
  if (!schema.items || typeof schema.items !== "object" || Array.isArray(schema.items)) return null;
  return schema.items as IFieldSchema;
}

export function isArrayFieldSchema(schema: IFieldSchema): boolean {
  return !!getArrayItemSchema(schema);
}
