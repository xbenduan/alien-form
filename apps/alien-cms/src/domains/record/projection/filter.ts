import {
  registry,
  resolveSceneRender,
} from "@alien-form/shared";
import type { DataSourceItem } from "@alien-form/core";
import {
  isSystemField,
  type CmsFieldSchema,
  type CmsModelSchema,
} from "../../model";
import {
  isContainerField,
  toSafeFieldKey,
  visitSchemaFields,
  withoutCmsMetadata,
} from "./field-traversal";

export interface FilterFieldProjection {
  key: string;
  safeKey: string;
  path: string;
  title: string;
  component?: string;
  operator: string;
  props?: Record<string, unknown>;
  dataSource?: DataSourceItem[];
  defaultVisible: boolean;
  order: number;
  field: CmsFieldSchema;
}

export interface RecordFilterProjection {
  schema: CmsModelSchema;
  fields: FilterFieldProjection[];
  defaultVisibleKeys: string[];
  keyToPath: Record<string, string>;
}

export type DynamicDataSourceMap = Record<string, DataSourceItem[]>;

function projectFilterFields(
  schema: CmsModelSchema,
  dynamicDataSources: DynamicDataSourceMap,
): FilterFieldProjection[] {
  const result: FilterFieldProjection[] = [];

  visitSchemaFields(schema, (visit) => {
    const { field, key, path, pathSegments, topLevel } = visit;
    if (topLevel && isSystemField(key)) {
      return false;
    }
    if (field.display === "none" || field["x-cms"]?.filter?.visible === false) {
      return false;
    }
    if (isContainerField(field)) {
      return true;
    }

    const title = field.title ?? key;
    const filterMeta = field["x-cms"]?.filter;
    const resolved = resolveSceneRender(field, "filter", registry, {
      operator: filterMeta?.operator,
      props: filterMeta?.props,
    });
    const props = {
      ...(resolved?.props ?? field.props),
    };
    if (props.placeholder === undefined) {
      props.placeholder = `请输入${title}`;
    }

    const projectedField = withoutCmsMetadata(field);
    const { default: _default, required: _required, ...renderableField } = projectedField;
    const dataSource =
      dynamicDataSources[path] ??
      field.dataSource;
    const flatKey = pathSegments.length > 1 ? `$root.${path}` : path;
    const safeKey = toSafeFieldKey(flatKey);

    result.push({
      key: flatKey,
      safeKey,
      path,
      title,
      component: resolved?.componentKey ?? field.component,
      operator: resolved?.operator ?? filterMeta?.operator ?? "contains",
      props,
      dataSource,
      defaultVisible: filterMeta?.defaultVisible ?? false,
      order: result.length,
      field: {
        ...renderableField,
        component: resolved?.componentKey ?? field.component,
        dataSource,
        title,
        decorator: "FilterItem",
        props,
      },
    });

    return false;
  });

  return result;
}

function resolveDefaultVisibleKeys(
  schema: CmsModelSchema,
  fields: FilterFieldProjection[],
): string[] {
  const explicitKeys = fields
    .filter((field) => field.defaultVisible)
    .map((field) => field.safeKey);
  if (explicitKeys.length > 0) {
    return explicitKeys;
  }

  return fields
    .slice(0, schema["x-model"]?.filter?.count ?? 3)
    .map((field) => field.safeKey);
}

export function projectFilter(
  schema: CmsModelSchema | undefined,
  dynamicDataSources: DynamicDataSourceMap = {},
): RecordFilterProjection | undefined {
  if (!schema?.properties) {
    return undefined;
  }

  const fields = projectFilterFields(schema, dynamicDataSources);
  return {
    schema: {
      type: "object",
      properties: Object.fromEntries(
        fields.map((field) => [field.safeKey, field.field]),
      ),
    },
    fields,
    defaultVisibleKeys: resolveDefaultVisibleKeys(schema, fields),
    keyToPath: Object.fromEntries(
      fields.map((field) => [field.safeKey, field.path]),
    ),
  };
}
