import type { GroupConfig } from "../../types/shared";
import { getDefaultFieldSchema, getRegistryEntry } from "../../register/global/form/registry";
import { DEFAULT_RECORD_SERVICES } from "./types";
import type {
  AfUiNode,
  FieldDraft,
  GroupDraft,
  ModelDraft,
  ModelFieldSchema,
  ModelSchema,
} from "./types";

export const DEFAULT_LAYOUT: AfUiNode = {
  component: "page",
  props: { services: DEFAULT_RECORD_SERVICES },
  children: [
    { component: "filter", props: { scope: "main" } },
    {
      component: "table",
      props: { scope: "main" },
      children: [
        {
          component: "row-actions",
          children: [
            { component: "detail" },
            { component: "edit" },
            { component: "delete" },
          ],
        },
      ],
      slots: {
        toolbarLeft: [{ component: "action-batch-delete" }],
        toolbarRight: [
          { component: "action-refresh" },
          { component: "action-add" },
        ],
      },
    },
  ],
};

function cloneLayout(layout: AfUiNode): AfUiNode {
  return JSON.parse(JSON.stringify(layout)) as AfUiNode;
}

/** 默认 uid 生成器（注入以隔离唯一的可变状态）。 */
export function createIdFactory(): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `af-${Date.now()}-${counter}`;
  };
}

// ─── draft → schema ──────────────────────────────────────────────────────────

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

/** 模型草稿 → 配置态 ModelSchema。 */
export function draftToSchema(draft: ModelDraft): ModelSchema {
  const properties = buildProperties(draft.fields);

  const groups: GroupConfig[] = draft.groups
    .filter((group) => group.keys.length > 0)
    .map((group) => {
      const gridSpan = Math.min(24, Math.max(1, Math.floor(group.gridSpan || 12)));
      return {
        component: group.component,
        keys: group.keys,
        props: { gridSpan, title: group.title || undefined },
      };
    });

  return {
    type: "object",
    title: draft.title,
    description: draft.description,
    properties,
    "x-layout": cloneLayout(draft.layout),
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

// ─── schema → draft ──────────────────────────────────────────────────────────

function toFieldDraft(key: string, field: ModelFieldSchema, uid: () => string): FieldDraft {
  const fieldType = getRegistryEntry(field.component)?.fieldType;
  const itemProps = field.items && !Array.isArray(field.items) ? field.items.properties : undefined;
  const childProps =
    fieldType === "object" ? field.properties : fieldType === "array" ? itemProps : undefined;

  const { properties: _properties, items: _items, ...rest } = field;
  return {
    id: uid(),
    fields: { key, ...rest },
    children: childProps
      ? Object.entries(childProps).map(([childKey, childField]) =>
          toFieldDraft(childKey, childField, uid),
        )
      : undefined,
  };
}

/** ModelSchema → 构建器草稿。 */
export function schemaToDraft(schema: ModelSchema, uid: () => string): ModelDraft {
  const fields = Object.entries(schema.properties).map(([key, field]) =>
    toFieldDraft(key, field, uid),
  );

  const groups: GroupDraft[] = (schema.group ?? []).map((group) => ({
    id: uid(),
    title: typeof group.props?.title === "string" ? group.props.title : (group.title ?? ""),
    component: group.component,
    keys: group.keys,
    gridSpan:
      typeof group.props?.gridSpan === "number" && group.props.gridSpan > 0
        ? group.props.gridSpan
        : 12,
  }));

  return {
    name: schema.meta.name,
    title: schema.meta.title,
    subtitle: schema.meta.subtitle ?? "",
    description: schema.meta.description ?? "",
    group: schema.meta.group ?? "other",
    singularLabel: schema.meta.singularLabel,
    pluralLabel: schema.meta.pluralLabel,
    defaultPageSize: schema.meta.defaultPageSize,
    filterCount: schema.meta.filterCount ?? 3,
    openMode: schema.meta.openMode,
    fields,
    groups,
    layout: cloneLayout(schema["x-layout"]),
  };
}

/** 新建模型时的空草稿。 */
export function createEmptyDraft(uid: () => string): ModelDraft {
  return {
    name: "",
    title: "新模型",
    subtitle: "",
    description: "",
    group: "other",
    singularLabel: "记录",
    pluralLabel: "记录",
    defaultPageSize: 10,
    filterCount: 3,
    openMode: { add: "drawer", edit: "drawer", detail: "drawer" },
    fields: [createFieldDraft(uid)],
    groups: [],
    layout: cloneLayout(DEFAULT_LAYOUT),
  };
}

/** 新建字段草稿：默认单行文本，schema 取自组件注册机的默认模板。 */
export function createFieldDraft(uid: () => string): FieldDraft {
  const suffix = uid().split("-").pop();
  return {
    id: uid(),
    fields: {
      ...(getDefaultFieldSchema("Input") as ModelFieldSchema),
      key: `field_${suffix}`,
      title: "新字段",
    },
    children: undefined,
  };
}

/** 新建分组草稿。 */
export function createGroupDraft(uid: () => string): GroupDraft {
  return {
    id: uid(),
    title: "新分组",
    component: "GridLayout",
    keys: [],
    gridSpan: 12,
  };
}
