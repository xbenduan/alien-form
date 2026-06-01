import type { CmsModelSchema } from "../types/schema";
import type { TableColumnProjection } from "./types";
import { sortSchemaEntries } from "./shared";

export function projectTableColumns(schema: CmsModelSchema): TableColumnProjection[] {
  const entries = sortSchemaEntries(schema.properties);
  const visibleColumns = entries.flatMap(([key, field]) => {
    if (!field["x-cms"]?.table?.visible) {
      return [];
    }

    return [
      {
        key,
        title: field.title ?? key,
        width: field["x-cms"]?.table?.width,
        ellipsis: field["x-cms"]?.table?.ellipsis,
        format: field["x-cms"]?.table?.format,
        inline: field["x-cms"]?.table?.inline,
        expandable: field["x-cms"]?.table?.expandable,
        dataSource: field.dataSource,
        type: field.type,
        order: field.order ?? 0,
        field,
      },
    ];
  });

  if (visibleColumns.length > 0) {
    return visibleColumns;
  }

  // Fallback: show first 5 fields
  return entries.slice(0, 5).map(([key, field]) => ({
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
