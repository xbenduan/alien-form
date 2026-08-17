import type { CmsFieldSchema, CmsModelSchema } from "../types";

export function countAtomicFields(schema: CmsModelSchema | CmsFieldSchema | undefined): number {
  if (!schema?.properties) return 0;
  return Object.values(schema.properties).reduce((count, field) => count + countField(field), 0);
}

function countField(field: CmsFieldSchema): number {
  if ((field["x-layout"] || field.type === "object") && field.properties) {
    return countAtomicFields(field);
  }

  if (field.type === "array") {
    const items = field.items;
    if (items && !Array.isArray(items) && items.type === "object" && items.properties) {
      return countAtomicFields(items);
    }
  }

  return 1;
}
