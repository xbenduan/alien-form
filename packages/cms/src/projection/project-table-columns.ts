import type { CmsModelSchema } from "../types/schema";
import type { TableColumnProjection } from "./types";
import { sortSchemaEntries } from "./schema-utils";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDefaultColumnWidth(column: {
  title: string;
  key: string;
  type?: string;
  format?: string;
}) {
  const label = column.title || column.key;
  const titleWidth = label.length * 16 + 32;

  if (column.format === "date" || column.format === "dateTime") {
    return Math.max(160, titleWidth);
  }

  if (column.type === "boolean" || column.format === "status") {
    return Math.max(120, titleWidth);
  }

  if (column.type === "array" || column.type === "object" || column.type === "void") {
    return Math.max(220, titleWidth);
  }

  return clamp(titleWidth, 120, 240);
}

export function projectTableColumns(schema: CmsModelSchema): TableColumnProjection[] {
  const entries = sortSchemaEntries(schema.properties);
  const visibleKeys = schema["x-model"]?.table?.visible;
  const defaultModelWidth = schema["x-model"]?.table?.width;
  const visibleKeySet = Array.isArray(visibleKeys) && visibleKeys.length > 0
    ? new Set(visibleKeys)
    : undefined;

  return entries
    .filter(([key]) => !visibleKeySet || visibleKeySet.has(key))
    .map(([key, field]) => {
      const title = field.title ?? key;
      const format = field["x-cms"]?.table?.format;
      const width =
        field["x-cms"]?.table?.width
        ?? defaultModelWidth
        ?? getDefaultColumnWidth({
          title,
          key,
          type: field.type,
          format,
        });

      return {
        key,
        title,
        width,
        ellipsis: field["x-cms"]?.table?.ellipsis ?? true,
        format,
        inline: field["x-cms"]?.table?.inline,
        expandable: field["x-cms"]?.table?.expandable,
        dataSource: field.dataSource,
        type: field.type,
        order: field.order ?? 0,
        field,
      };
    });
}
