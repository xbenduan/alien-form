import { getRegistryEntry } from "@alien-form/shared";
import type { ModelFieldSchema, ModelSchema } from "../../../services";
import type { FieldDraft, GroupDraft, ModelDraft } from "../types";
import { defaultFieldSchema } from "./field-types";

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

/**
 * ModelFieldSchema → 字段草稿。
 * 字段自身的 schema 直接挂在 `fields` 上（编辑器就地读写），key 也并入 `fields.key`，
 * 便于在 JSON 编辑框内直接查看/修改；仅把子字段（object.properties / array.items.properties）
 * 提出来交给 children 管理以便拖拽排序，`fields` 中不再冗余保存这些子结构。
 * 容器类型由组件注册项的 fieldType 判定（不再反推）。
 */
function toFieldDraft(key: string, field: ModelFieldSchema): FieldDraft {
  const fieldType = getRegistryEntry(field.component)?.fieldType;
  const itemProps =
    field.items && !Array.isArray(field.items) ? field.items.properties : undefined;
  const childProps =
    fieldType === "object" ? field.properties : fieldType === "array" ? itemProps : undefined;

  const { properties: _properties, items: _items, ...rest } = field;
  return {
    id: uid("field"),
    fields: { key, ...rest },
    children: childProps
      ? Object.entries(childProps).map(([childKey, childField]) => toFieldDraft(childKey, childField))
      : undefined,
  };
}

/** ModelSchema → 构建器草稿（编辑模型时用）。 */
export function schemaToDraft(schema: ModelSchema): ModelDraft {
  const fields = Object.entries(schema.properties).map(([key, field]) =>
    toFieldDraft(key, field),
  );

  const groups: GroupDraft[] = (schema.group ?? []).map((group) => ({
    id: uid("group"),
    title:
      typeof group.props?.title === "string"
        ? group.props.title
        : group.title ?? "",
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
  };
}

/** 新建模型时的空草稿。 */
export function createEmptyDraft(): ModelDraft {
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
    fields: [createFieldDraft()],
    groups: [],
  };
}

/** 新建字段草稿：默认单行文本，schema 取自组件注册机的默认模板。 */
export function createFieldDraft(): FieldDraft {
  const suffix = uid("f").split("-").pop();
  return {
    id: uid("field"),
    fields: {
      ...defaultFieldSchema("Input"),
      key: `field_${suffix}`,
      title: "新字段",
    },
    children: undefined,
  };
}

/** 新建分组草稿。 */
export function createGroupDraft(): GroupDraft {
  return {
    id: uid("group"),
    title: "新分组",
    component: "GridLayout",
    keys: [],
    gridSpan: 12,
  };
}
