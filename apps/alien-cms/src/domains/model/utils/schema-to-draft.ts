import type { ModelFieldSchema, ModelSchema } from "../../../services";
import type { FieldDraft, GroupDraft, ModelDraft } from "../types";
import { FIELD_TYPE_META, inferFieldType } from "./field-types";

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
 */
function toFieldDraft(key: string, field: ModelFieldSchema): FieldDraft {
  const type = inferFieldType(field);
  const itemProps =
    field.items && !Array.isArray(field.items) ? field.items.properties : undefined;
  const childProps = type === "object" ? field.properties : type === "array" ? itemProps : undefined;

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

/** 新建字段草稿。 */
export function createFieldDraft(): FieldDraft {
  const suffix = uid("f").split("-").pop();
  const meta = FIELD_TYPE_META.string;
  return {
    id: uid("field"),
    fields: {
      key: `field_${suffix}`,
      type: meta.schemaType,
      title: "新字段",
      component: meta.component,
      "x-table": { visible: true },
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
