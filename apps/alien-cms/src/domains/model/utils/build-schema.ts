import type { DataSourceItem } from "@alien-form/react";
import type { GroupConfig } from "@alien-form/shared";
import type { ModelFieldSchema, ModelSchema } from "../../../services";
import type { FieldDraft, ModelDraft } from "../types";
import { FIELD_TYPE_META } from "./field-types";

function parseJson<T>(text: string): T | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return undefined;
  }
}

function buildFieldSchema(draft: FieldDraft, order: number): ModelFieldSchema {
  const meta = FIELD_TYPE_META[draft.type];
  const dataSource = parseJson<DataSourceItem[]>(draft.dataSourceText);
  const handlerParams = parseJson<Record<string, unknown>>(draft.handlerParamsText);

  const field: ModelFieldSchema = {
    title: draft.title || draft.key,
    component: meta.component,
    order,
  };
  if (meta.schemaType) field.type = meta.schemaType;
  if (draft.required) field.required = true;
  if (Array.isArray(dataSource)) field.dataSource = dataSource;

  if (draft.handler) {
    field["x-reaction"] = { dataSource: `@${draft.handler}` };
    if (handlerParams) field["x-handler-params"] = { dataSource: handlerParams };
  }

  const width = Number(draft.tableWidthText);
  field["x-table"] = {
    ...(Number.isFinite(width) && width > 0 ? { width } : {}),
    visible: draft.tableVisible,
  };

  // 复杂字段：递归构建子字段
  if (draft.type === "object" && draft.children) {
    field.properties = buildProperties(draft.children);
  }
  if (draft.type === "array" && draft.children) {
    field.type = "array";
    field.items = { type: "object", properties: buildProperties(draft.children) };
  }

  return field;
}

function buildProperties(fields: FieldDraft[]): Record<string, ModelFieldSchema> {
  return Object.fromEntries(
    fields.map((field, index) => [field.key, buildFieldSchema(field, (index + 1) * 10)]),
  );
}

/** 模型草稿 → 配置态 ModelSchema（同时驱动 form / table / filter）。 */
export function buildModelSchema(draft: ModelDraft): ModelSchema {
  const properties = buildProperties(draft.fields);

  const groups: GroupConfig[] = draft.groups
    .filter((group) => group.keys.length > 0)
    .map((group) => {
      const gridSpan = Math.min(24, Math.max(1, Math.floor(group.gridSpan || 12)));
      return {
        component: group.component,
        title: group.title || undefined,
        keys: group.keys,
        props: { gridSpan },
      };
    });

  return {
    type: "object",
    title: draft.title,
    description: draft.description,
    properties,
    ...(groups.length > 0 ? { group: groups } : {}),
    meta: {
      name: draft.name,
      title: draft.title,
      subtitle: draft.subtitle || undefined,
      description: draft.description || undefined,
      singularLabel: draft.singularLabel || "记录",
      pluralLabel: draft.pluralLabel || "记录",
      defaultPageSize: draft.defaultPageSize,
      filterCount: draft.filterCount,
      openMode: draft.openMode,
    },
  };
}
