import type { CmsFieldSchema } from "../types/schema";

export function sortSchemaEntries<T extends CmsFieldSchema>(fields: Record<string, T> = {}) {
  return Object.entries(fields).sort(
    ([, left], [, right]) => (left.order ?? 0) - (right.order ?? 0),
  );
}
