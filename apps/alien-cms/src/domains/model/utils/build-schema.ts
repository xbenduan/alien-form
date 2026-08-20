import type { GroupConfig } from "@alien-form/shared";
import type { ModelFieldSchema, ModelSchema } from "../../../services";
import type { FieldDraft, ModelDraft } from "../types";
import { FIELD_TYPE_META } from "./field-types";

function parseSchema(text: string): ModelFieldSchema | undefined {
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as ModelFieldSchema)
      : undefined;
  } catch {
    return undefined;
  }
}

function buildFieldSchema(draft: FieldDraft, order: number): ModelFieldSchema {
  const meta = FIELD_TYPE_META[draft.type];
  const title = draft.title || draft.key;
  const props = {
    ...(meta.container ? { title } : {}),
    ...(draft.placeholder ? { placeholder: draft.placeholder } : {}),
  };

  const custom = parseSchema(draft.schemaJsonText);
  const field: ModelFieldSchema = {
    ...(custom ?? {}),
    component: meta.component,
    order,
    ...(meta.container ? {} : { title }),
    ...(Object.keys(props).length > 0 ? { props: { ...custom?.props, ...props } } : {}),
  };
  if (meta.schemaType) field.type = meta.schemaType;
  if (draft.required) field.required = true;

  const width = Number(draft.tableWidthText);
  field["x-table"] = {
    ...(Number.isFinite(width) && width > 0 ? { width } : {}),
    visible: draft.tableVisible,
  };

  // 复杂字段：递归构建子字段
  if (draft.type === "object" && draft.children && !custom?.properties) {
    field.properties = buildProperties(draft.children);
  }
  if (draft.type === "array" && draft.children && !custom?.items) {
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
        keys: group.keys,
        props: {
          gridSpan,
          title: group.title || undefined,
        },
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
