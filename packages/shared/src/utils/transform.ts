import type { IFieldSchema, IFormSchema } from "@alien-form/react";
import type { SchemaConfig, TableColumn } from "../types";
import { getComponentMeta } from "./component-meta";
import { collectLeafFields, isComplexField } from "./schema";
import { multiValueFormat } from "./multi-value";

interface TableMeta {
  width?: number;
  ellipsis?: boolean;
  sortable?: boolean;
  visible?: boolean;
}

function readTableMeta(field: IFieldSchema): TableMeta {
  return ((field as Record<string, unknown>)["x-table"] as TableMeta | undefined) ?? {};
}

function sortEntries(properties: Record<string, IFieldSchema>): Array<[string, IFieldSchema]> {
  return Object.entries(properties).sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0));
}

function mapProperties(properties: Record<string, IFieldSchema>): Record<string, IFieldSchema> {
  return Object.fromEntries(
    Object.entries(properties).map(([key, field]) => [key, transformFieldForForm(field)]),
  );
}

/**
 * 单字段 → form 渲染语义：
 *  - 复杂 object：保留 component（默认 ObjectField），递归转换子字段
 *  - 对象数组：保留 component（默认 ArrayCards），递归转换 items 子字段
 *  - 多值叶子：降级为 string 基元 + x-format 桥接（数组 ↔ JSON 字符串）
 *  - 普通叶子：原样返回
 */
export function transformFieldForForm(field: IFieldSchema): IFieldSchema {
  const meta = getComponentMeta(field.component);

  if (field.type === "array" && field.items && !Array.isArray(field.items)) {
    const items = field.items;
    return {
      ...field,
      type: "array",
      title: undefined,
      props: { ...field.props, title: field?.props?.title ?? field.title ?? "" },
      component: field.component ?? "ArrayCards",
      items: items.properties
        ? { ...items, type: "object", properties: mapProperties(items.properties) }
        : items,
    };
  }

  if (field.properties && (field.type === "object" || meta?.fieldType === "object")) {
    return {
      ...field,
      type: "object",
      title: undefined,
      props: { ...field.props, title: field?.props?.title ?? field.title ?? "" },
      component: field.component ?? "ObjectField",
      properties: mapProperties(field.properties),
    };
  }

  if (meta?.multiValue) {
    return {
      ...field,
      type: "string",
      "x-format": multiValueFormat,
    };
  }

  return { ...field };
}

/**
 * 配置态 schema → form schema。
 * group 中的字段被收进 x-layout void 容器（GridLayout），未分组的顶层字段保持原位；
 * group 节点插入在其首个成员字段的原始位置，保证渲染顺序自然。
 */
export function buildFormSchema(config: SchemaConfig): IFormSchema {
  const properties = config.properties ?? {};
  const groups = config.group ?? [];

  const keyToGroup = new Map<string, number>();
  groups.forEach((group, index) => {
    for (const key of group.keys) keyToGroup.set(key, index);
  });

  const emittedGroups = new Set<number>();
  const output: Record<string, IFieldSchema> = {};

  sortEntries(properties).forEach(([key, field], index) => {
    const groupIndex = keyToGroup.get(key);
    if (groupIndex === undefined) {
      output[key] = { ...transformFieldForForm(field), order: field.order ?? index };
      return;
    }
    if (emittedGroups.has(groupIndex)) return;
    emittedGroups.add(groupIndex);

    const group = groups[groupIndex];
    const groupProperties: Record<string, IFieldSchema> = {};
    group.keys.forEach((memberKey, memberIndex) => {
      const memberField = properties[memberKey];
      if (!memberField) return;
      groupProperties[memberKey] = {
        ...transformFieldForForm(memberField),
        order: memberIndex,
      };
    });

    output[`group-${groupIndex}`] = {
      "x-layout": group.component,
      type: "void",
      title: group.title,
      props: group.props,
      order: field.order ?? index,
      properties: groupProperties,
    };
  });

  return {
    type: "object",
    title: config.title,
    description: config.description,
    properties: output,
  };
}

/**
 * 配置态 schema → filter schema。
 * 递归收集所有叶子字段并平铺到顶层；不含任何校验、默认值、必填。
 */
export function buildFilterSchema(config: SchemaConfig): IFormSchema {
  const leaves = collectLeafFields(config.properties);
  const properties: Record<string, IFieldSchema> = {};

  for (const { key, field } of leaves) {
    if (field.display === "none") continue;
    const meta = getComponentMeta(field.component);
    const { required: _required, default: _default, "x-validate": _validate, ...rest } = field;
    properties[key] = {
      ...rest,
      title: field.title ?? key,
      decorator: "FilterItem",
      ...(field.component === "Textarea" ? { props: { ...field.props, rows: 1 } } : {}),
      ...(meta?.multiValue ? { type: "string", "x-format": multiValueFormat } : {}),
    };
  }

  return { type: "object", properties };
}

/**
 * 配置态 schema → table columns。
 * 只取顶层字段；复杂字段（object/array）标记 complex，由单元格渲染摘要 + 详情按钮。
 */
export function buildTableColumns(config: SchemaConfig): TableColumn[] {
  const properties = config.properties ?? {};
  return sortEntries(properties)
    .filter(([, field]) => field.display !== "none")
    .filter(([, field]) => readTableMeta(field).visible !== false)
    .map(([key, field]) => {
      const complex = isComplexField(field);
      const tableMeta = readTableMeta(field);
      return {
        key,
        title:
          field.title ??
          (typeof field.props?.title === "string" ? field.props.title : undefined) ??
          key,
        width: tableMeta.width,
        ellipsis: tableMeta.ellipsis ?? true,
        sortable: tableMeta.sortable ?? !complex,
        complex,
        component: field.component,
        dataSource: field.dataSource,
        field: transformFieldForForm(field),
      } satisfies TableColumn;
    });
}
