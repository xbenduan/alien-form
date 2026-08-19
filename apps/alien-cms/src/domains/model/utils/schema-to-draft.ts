import type { ModelFieldSchema, ModelSchema } from "../../../services";
import type { BuilderFieldType, FieldDraft, GroupDraft, ModelDraft } from "../types";
import { getDefaultPlaceholder } from "./field-types";

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

/** 由 component + type 反推构建器字段类型。 */
function inferFieldType(field: ModelFieldSchema): BuilderFieldType {
  const component = field.component;
  if (component === "MultiSelect") return "multiSelect";
  if (component === "TagsInput") return "tags";
  if (component === "Select" || component === "Radio") return "select";
  if (component === "DateInput") return "date";
  if (component === "Switch") return "boolean";
  if (component === "NumberInput") return "number";
  if (component === "ObjectField" || field.type === "object") return "object";
  if (component === "ArrayCards" || field.type === "array") return "array";
  return "string";
}

function toFieldDraft(key: string, field: ModelFieldSchema): FieldDraft {
  const type = inferFieldType(field);
  const handler =
    typeof field["x-reaction"]?.dataSource === "string"
      ? String(field["x-reaction"]!.dataSource).replace(/^@/, "")
      : undefined;
  const handlerParams = field["x-handler-params"]?.dataSource;

  const itemProps =
    field.items && !Array.isArray(field.items) ? field.items.properties : undefined;
  const children = type === "object" ? field.properties : type === "array" ? itemProps : undefined;

  return {
    id: uid("field"),
    key,
    title:
      typeof field.props?.title === "string"
        ? field.props.title
        : field.title ?? key,
    type,
    component: field.component ?? "Input",
    placeholder:
      typeof field.props?.placeholder === "string"
        ? field.props.placeholder
        : getDefaultPlaceholder(type),
    required: field.required === true,
    dataSourceText: field.dataSource ? JSON.stringify(field.dataSource, null, 2) : "",
    handler,
    handlerParamsText: handlerParams ? JSON.stringify(handlerParams, null, 2) : "",
    tableWidthText: field["x-table"]?.width ? String(field["x-table"].width) : "",
    tableVisible: field["x-table"]?.visible !== false,
    children: children
      ? Object.entries(children).map(([childKey, childField]) => toFieldDraft(childKey, childField))
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
  return {
    id: uid("field"),
    key: `field_${suffix}`,
    title: "新字段",
    type: "string",
    component: "Input",
    placeholder: getDefaultPlaceholder("string"),
    required: false,
    dataSourceText: "",
    handler: undefined,
    handlerParamsText: "",
    tableWidthText: "",
    tableVisible: true,
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
