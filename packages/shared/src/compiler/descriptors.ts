import type { IFieldSchema } from "@alien-form/react";
import type { TableColumn } from "../types";
import { getComponentMeta } from "../components/register";
import type { FieldDescriptor, ModelFieldSchema } from "./types";
import { multiValueFormat } from "./utils/multi-value";
import { isComplexField } from "./utils/schema";

/** 读 x-table 元信息。 */
function tableMeta(field: ModelFieldSchema) {
  return field["x-table"] ?? {};
}

/** filter 场景剥离校验/默认/必填，套上 FilterItem 装饰器。 */
function toFilterBase(field: IFieldSchema, key: string): IFieldSchema {
  const { required: _r, default: _d, "x-validate": _v, ...rest } = field;
  return { ...rest, title: field.title ?? key, decorator: "FilterItem" };
}

/** 复杂字段列的公共列定义。 */
function complexColumn(field: ModelFieldSchema, key: string, formField: IFieldSchema): TableColumn {
  const meta = tableMeta(field);
  return {
    key,
    title: field.title ?? (typeof field.props?.title === "string" ? field.props.title : key),
    width: meta.width,
    ellipsis: meta.ellipsis ?? true,
    sortable: meta.sortable ?? false,
    complex: true,
    component: field.component,
    field: formField,
  };
}

/**
 * 对象容器（object）：form 下渲染为 ObjectField，递归投影子字段；
 * table 下折叠为摘要 + 详情按钮；不进筛选区（子字段由 filter 平铺处理）。
 */
const objectDescriptor: FieldDescriptor = {
  name: "object",
  match: (field) => {
    const meta = getComponentMeta(field.component);
    return Boolean(field.properties) && (field.type === "object" || meta?.fieldType === "object");
  },
  toForm: (field, ctx) => ({
    ...(field as IFieldSchema),
    type: "object",
    title: undefined,
    props: { ...field.props, title: field.props?.title ?? field.title ?? "" },
    component: field.component ?? "ObjectField",
    properties: ctx.projectProperties(field.properties ?? {}),
  }),
  toFilter: () => undefined,
  toColumn: (field, key, ctx) => complexColumn(field, key, objectDescriptor.toForm(field, ctx)),
};

/**
 * 对象数组（array）：form 下渲染为 ArrayCards，递归投影 items 子字段；
 * table 下折叠为摘要 + 详情按钮；不进筛选区。
 */
const arrayDescriptor: FieldDescriptor = {
  name: "array",
  match: (field) =>
    field.type === "array" && Boolean(field.items) && !Array.isArray(field.items),
  toForm: (field, ctx) => {
    const items = field.items as ModelFieldSchema;
    return {
      ...(field as IFieldSchema),
      type: "array",
      title: undefined,
      props: { ...field.props, title: field.props?.title ?? field.title ?? "" },
      component: field.component ?? "ArrayCards",
      items: items.properties
        ? { ...(items as IFieldSchema), type: "object", properties: ctx.projectProperties(items.properties) }
        : (items as IFieldSchema),
    };
  },
  toFilter: () => undefined,
  toColumn: (field, key, ctx) => complexColumn(field, key, arrayDescriptor.toForm(field, ctx)),
};

/**
 * 多值叶子（多选 / 标签 / 复选组）：值为数组，降级为 string 基元 +
 * x-format 桥接（数组 ↔ JSON 字符串）。
 */
const multiValueDescriptor: FieldDescriptor = {
  name: "multiValue",
  match: (field) => Boolean(getComponentMeta(field.component)?.multiValue),
  toForm: (field) => ({
    ...(field as IFieldSchema),
    type: "string",
    "x-format": multiValueFormat,
  }),
  toFilter: (field, key) => ({
    ...toFilterBase(field as IFieldSchema, key),
    type: "string",
    "x-format": multiValueFormat,
  }),
  toColumn: (field, key) => leafColumn(field, key),
};

/** 普通叶子字段：原样投影。 */
const primitiveDescriptor: FieldDescriptor = {
  name: "primitive",
  match: () => true,
  toForm: (field) => ({ ...(field as IFieldSchema) }),
  toFilter: (field, key) => {
    const base = toFilterBase(field as IFieldSchema, key);
    if (field.component === "Textarea") {
      return { ...base, props: { ...field.props, rows: 1 } };
    }
    return base;
  },
  toColumn: (field, key) => leafColumn(field, key),
};

/** 叶子列的公共列定义。 */
function leafColumn(field: ModelFieldSchema, key: string): TableColumn {
  const meta = tableMeta(field);
  const complex = isComplexField(field as IFieldSchema);
  return {
    key,
    title:
      field.title ?? (typeof field.props?.title === "string" ? field.props.title : undefined) ?? key,
    width: meta.width,
    ellipsis: meta.ellipsis ?? true,
    sortable: meta.sortable ?? !complex,
    complex,
    component: field.component,
    dataSource: Array.isArray(field.dataSource) ? field.dataSource : undefined,
    field: { ...(field as IFieldSchema) },
  };
}

/** 内置描述符表：匹配顺序自上而下，第一个命中生效。 */
export const defaultDescriptors: FieldDescriptor[] = [
  objectDescriptor,
  arrayDescriptor,
  multiValueDescriptor,
  primitiveDescriptor,
];

/** 从描述符表挑出命中该字段的第一个描述符。 */
export function matchDescriptor(
  field: ModelFieldSchema,
  descriptors: FieldDescriptor[],
): FieldDescriptor {
  return descriptors.find((descriptor) => descriptor.match(field)) ?? primitiveDescriptor;
}
