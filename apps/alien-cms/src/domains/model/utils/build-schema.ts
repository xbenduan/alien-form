import type { GroupConfig } from "@alien-form/shared";
import { getRegistryEntry } from "@alien-form/shared";
import type { ModelFieldSchema, ModelSchema } from "../../../services";
import type { FieldDraft, ModelDraft } from "../types";

/**
 * 字段草稿 → schema：草稿已直接持有字段 schema（draft.fields），
 * 这里只补 order、剥离编辑态承载的 key、并把 children 还原成 properties / items.properties。
 * 容器类型（object / array）由组件注册项的 fieldType 判定，不再反推。
 */
function buildFieldSchema(draft: FieldDraft, order: number): ModelFieldSchema {
  const { key: _key, ...rest } = draft.fields;
  const field: ModelFieldSchema = { ...rest, order };
  const fieldType = getRegistryEntry(field.component)?.fieldType;

  if (fieldType === "object" && draft.children) {
    field.type = "object";
    field.properties = buildProperties(draft.children);
  } else if (fieldType === "array" && draft.children) {
    field.type = "array";
    field.items = { type: "object", properties: buildProperties(draft.children) };
  }

  return field;
}

function buildProperties(fields: FieldDraft[]): Record<string, ModelFieldSchema> {
  return Object.fromEntries(
    fields.map((field, index) => [
      field.fields.key ?? `field_${index + 1}`,
      buildFieldSchema(field, (index + 1) * 10),
    ]),
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
      group: draft.group,
      singularLabel: draft.singularLabel || "记录",
      pluralLabel: draft.pluralLabel || "记录",
      defaultPageSize: draft.defaultPageSize,
      filterCount: draft.filterCount,
      openMode: draft.openMode,
    },
  };
}
