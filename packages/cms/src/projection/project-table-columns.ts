import type { CmsModelSchema } from "../types/schema";
import type { TableColumnProjection } from "./types";
import { sortSchemaEntries } from "./shared";

export function projectTableColumns(schema: CmsModelSchema): TableColumnProjection[] {
  const entries = sortSchemaEntries(schema.properties);
  const visibleKeys = schema["x-model"]?.table?.visible;
  const visibleKeySet = Array.isArray(visibleKeys) && visibleKeys.length > 0
    ? new Set(visibleKeys)
    : undefined;

  return entries
    .filter(([key]) => !visibleKeySet || visibleKeySet.has(key))
    .map(([key, field]) => ({
    key,
    title: field.title ?? key,
    width: field["x-cms"]?.table?.width,
      ellipsis: field["x-cms"]?.table?.ellipsis ?? true,
      format: field["x-cms"]?.table?.format,
      inline: field["x-cms"]?.table?.inline,
      expandable: field["x-cms"]?.table?.expandable,
      dataSource: field.dataSource,
      type: field.type,
      order: field.order ?? 0,
      field,
    }));
}
