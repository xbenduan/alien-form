import type { CmsFieldSchema, CmsModelSchema } from "../types/schema";
import type { FilterSchemaProjection } from "./types";
import { cloneFilterFieldSchema } from "./flatten-filter-schema-utils";
import { sortSchemaEntries } from "./schema-utils";

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

function getFilterPlaceholder(field: CmsFieldSchema, title: string) {
  if (field.type === "boolean" || field.component === "Select") {
    return `请选择${title}`;
  }
  return `请输入${title}`;
}

function buildFilterField(
  key: string,
  field: CmsFieldSchema,
  parentPath: string[],
  siblingKeys: Iterable<string>,
): CmsFieldSchema {
  const nextField = cloneFilterFieldSchema(field, parentPath, siblingKeys);
  const title = nextField.title ?? key;
  const isBooleanField = nextField.type === "boolean" || nextField.component === "Switch";

  return {
    ...nextField,
    title,
    component: isBooleanField ? "Select" : nextField.component,
    decorator: "FilterItem",
    display: "visible",
    props: {
      ...(nextField.props ?? {}),
      placeholder: String(nextField.props?.placeholder ?? getFilterPlaceholder(nextField, title)),
    },
    dataSource: isBooleanField
      ? [
          { label: "是", value: true },
          { label: "否", value: false },
        ]
      : nextField.dataSource,
  };
}

function collectFilterFields(
  properties: CmsModelSchema["properties"],
  defaultVisibleCount: number,
  parentPath: string[] = [],
): {
  entries: Array<[string, CmsFieldSchema]>;
  defaultVisibleKeys: string[];
} {
  const orderedEntries = sortSchemaEntries(properties);
  const siblingKeys = new Set(orderedEntries.map(([key]) => key));
  const entries: Array<[string, CmsFieldSchema]> = [];

  for (const [key, field] of orderedEntries) {
    const nextPath = [...parentPath, key];

    if (field.type === "object" || field.type === "void") {
      const nested = collectFilterFields(field.properties as CmsModelSchema["properties"], defaultVisibleCount, nextPath);
      entries.push(...nested.entries);
      continue;
    }

    if (field.type === "array" || isObjectArrayField(field)) {
      continue;
    }

    if (!FILTERABLE_FIELD_TYPES.has(field.type ?? "")) {
      continue;
    }

    const filterKey = nextPath.join(".");
    entries.push([
      filterKey,
      buildFilterField(filterKey, field, parentPath, siblingKeys),
    ]);
  }

  return {
    entries,
    defaultVisibleKeys: entries.slice(0, defaultVisibleCount).map(([key]) => key),
  };
}

export function projectFilterSchema(schema: CmsModelSchema): FilterSchemaProjection {
  const defaultVisibleCount = schema["x-model"]?.filter?.count ?? 3;
  const { entries, defaultVisibleKeys } = collectFilterFields(schema.properties, defaultVisibleCount);

  return {
    schema: {
      type: "object",
      properties: Object.fromEntries(entries),
    },
    defaultVisibleKeys,
  };
}
