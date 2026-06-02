import type { CmsModelSchema } from "../types/schema";
import type { FilterFieldProjection } from "./types";
import { sortSchemaEntries } from "./shared";

const FILTERABLE_FIELD_TYPES = new Set(["string", "number", "boolean"]);

function isObjectArrayField(field: {
  type?: string;
  items?: unknown;
}) {
  const items = field.items;
  return field.type === "array"
    && items != null
    && !Array.isArray(items)
    && typeof items === "object"
    && "type" in items
    && items.type === "object";
}

function collectFilterFields(
  properties: CmsModelSchema["properties"],
  parentKeys: string[] = [],
): FilterFieldProjection[] {
  const entries = sortSchemaEntries(properties);

  return entries.flatMap(([key, field]) => {
    const nextPath = [...parentKeys, key];

    if (field.type === "object" || field.type === "void") {
      return collectFilterFields(field.properties as CmsModelSchema["properties"], nextPath);
    }

    if (field.type === "array" || isObjectArrayField(field)) {
      return [];
    }

    if (!FILTERABLE_FIELD_TYPES.has(field.type ?? "")) {
      return [];
    }

    return [
      {
        key: nextPath.join("."),
        title: field.title ?? key,
        type: field.type,
        component: field.component,
        operator: field.type === "string" ? "contains" : "eq",
        props: field.props,
        dataSource: field.dataSource,
        defaultVisible: false,
        order: field.order ?? 0,
      },
    ];
  });
}

export function projectFilterFields(schema: CmsModelSchema): FilterFieldProjection[] {
  const defaultVisibleCount = schema["x-model"]?.filter?.count ?? 3;

  return collectFilterFields(schema.properties).map((field, index) => ({
    ...field,
    defaultVisible: index < defaultVisibleCount,
  }));
}
