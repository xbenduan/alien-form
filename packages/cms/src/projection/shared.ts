import type { CmsFieldSchema } from "../types/schema";

export function sortSchemaEntries<T extends CmsFieldSchema>(fields: Record<string, T> = {}) {
  return Object.entries(fields).sort(
    ([, left], [, right]) => (left.order ?? 0) - (right.order ?? 0),
  );
}

export function canUseInMode(field: CmsFieldSchema, mode: "add" | "edit") {
  const modes = field["x-cms"]?.form?.modes;
  if (!modes) {
    return true;
  }
  return modes.includes(mode);
}
