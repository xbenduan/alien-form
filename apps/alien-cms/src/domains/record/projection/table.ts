import {
  registry,
  resolveSceneRender,
  type TableColumnProjection,
  type TableInlineProjection,
} from "@alien-form/shared";
import {
  isSystemField,
  type CmsFieldSchema,
  type CmsModelSchema,
} from "../../model";
import type { DynamicDataSourceMap } from "./filter";
import {
  getChildProperties,
  getObjectArrayItem,
  isContainerField,
} from "./field-traversal";
import { projectDetailField } from "./scene-schema";

const ARRAY_INLINE_PREFERRED_KEYS = [
  "name",
  "title",
  "label",
  "format",
  "owner",
  "status",
];

function resolveInlineKeys(field: CmsFieldSchema): string[] {
  const explicitKeys = field["x-cms"]?.table?.inline;
  if (explicitKeys?.length) {
    return explicitKeys;
  }

  const properties = getChildProperties(field);
  if (!properties) {
    return [];
  }

  if (getObjectArrayItem(field)) {
    const preferredKeys = ARRAY_INLINE_PREFERRED_KEYS.filter(
      (key) => properties[key],
    );
    return (preferredKeys.length > 0 ? preferredKeys : Object.keys(properties))
      .slice(0, 2);
  }

  return Object.keys(properties).slice(0, 3);
}

function projectInlineFields(
  parentKey: string,
  field: CmsFieldSchema,
  dynamicDataSources: DynamicDataSourceMap,
): TableInlineProjection[] | undefined {
  const properties = getChildProperties(field);
  if (!properties) {
    return undefined;
  }

  const inline = resolveInlineKeys(field)
    .map((key): TableInlineProjection | undefined => {
      const child = properties[key];
      if (!child) {
        return undefined;
      }

      return {
        key,
        format:
          child["x-cms"]?.table?.format ??
          child["x-cms"]?.detail?.format,
        dataSource:
          dynamicDataSources[`${parentKey}.${key}`] ??
          child.dataSource,
      };
    })
    .filter((item): item is TableInlineProjection => Boolean(item));

  return inline.length > 0 ? inline : undefined;
}

export function projectTableColumns(
  schema: CmsModelSchema | undefined,
  visibleKeys?: string[],
  dynamicDataSources: DynamicDataSourceMap = {},
): TableColumnProjection[] {
  if (!schema?.properties) {
    return [];
  }

  const visibleKeySet = visibleKeys ? new Set(visibleKeys) : undefined;
  return Object.entries(schema.properties)
    .map(([key, field], index): TableColumnProjection => {
      const tableMeta = field["x-cms"]?.table;
      const resolved = resolveSceneRender(field, "table", registry, {
        props: tableMeta?.format ? { format: tableMeta.format } : undefined,
        summary: tableMeta?.expandable,
      });
      const visible = tableMeta?.visible;

      return {
        key,
        title: field.title ?? key,
        width: tableMeta?.width,
        ellipsis: tableMeta?.ellipsis ?? true,
        format: tableMeta?.format,
        dataSource: dynamicDataSources[key] ?? field.dataSource,
        inline: projectInlineFields(key, field, dynamicDataSources),
        expandable: tableMeta?.expandable ?? resolved?.summary,
        sortable:
          tableMeta?.sortable ??
          (!isContainerField(field) && field.type !== "array"),
        visible,
        defaultVisible:
          typeof visible === "boolean" ? visible : !isSystemField(key),
        order: tableMeta?.order ?? field.order ?? index,
        field: projectDetailField(field),
        type: field.type,
      };
    })
    .filter((column) => !visibleKeySet || visibleKeySet.has(column.key))
    .sort((left, right) => left.order - right.order);
}

export function buildTableFieldOptions(schema: CmsModelSchema | undefined) {
  return Object.entries(schema?.properties ?? {}).map(([key, field]) => ({
    value: key,
    label: `${field.title ?? key} (${key})`,
  }));
}
