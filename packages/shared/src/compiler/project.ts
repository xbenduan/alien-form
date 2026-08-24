import type { IFieldSchema, IFormSchema } from "@alien-form/react";
import type { GroupConfig, TableColumn } from "../types";
import type {
  DescriptorCtx,
  FieldDescriptor,
  Locale,
  ModelFieldSchema,
  ModelSchema,
} from "./types";
import { matchDescriptor } from "./descriptors";

function sortEntries(
  properties: Record<string, ModelFieldSchema>,
): Array<[string, ModelFieldSchema]> {
  return Object.entries(properties).sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0));
}

/** 构造描述符投影上下文（含递归投影子 properties 的能力）。 */
function createDescriptorCtx(
  scene: DescriptorCtx["scene"],
  locale: Locale,
  descriptors: FieldDescriptor[],
): DescriptorCtx {
  const ctx: DescriptorCtx = {
    scene,
    locale,
    projectProperties: (properties) => {
      const output: Record<string, IFieldSchema> = {};
      for (const [key, field] of Object.entries(properties)) {
        output[key] = matchDescriptor(field, descriptors).toForm(field, ctx);
      }
      return output;
    },
  };
  return ctx;
}

/**
 * form 投影：group 中的字段收进 x-layout void 容器（GridLayout），
 * 未分组字段保持原位；group 节点插在其首个成员的原始位置。
 */
export function projectForm(
  schema: ModelSchema,
  locale: Locale,
  descriptors: FieldDescriptor[],
): IFormSchema {
  const properties = schema.properties ?? {};
  const groups = schema.group ?? [];
  const ctx = createDescriptorCtx("form", locale, descriptors);

  const keyToGroup = new Map<string, number>();
  groups.forEach((group, index) => {
    for (const key of group.keys) keyToGroup.set(key, index);
  });

  const emittedGroups = new Set<number>();
  const output: Record<string, IFieldSchema> = {};

  sortEntries(properties).forEach(([key, field], index) => {
    const groupIndex = keyToGroup.get(key);
    if (groupIndex === undefined) {
      output[key] = {
        ...matchDescriptor(field, descriptors).toForm(field, ctx),
        order: field.order ?? index,
      };
      return;
    }
    if (emittedGroups.has(groupIndex)) return;
    emittedGroups.add(groupIndex);

    const group = groups[groupIndex] as GroupConfig;
    const groupProperties: Record<string, IFieldSchema> = {};
    group.keys.forEach((memberKey, memberIndex) => {
      const memberField = properties[memberKey];
      if (!memberField) return;
      groupProperties[memberKey] = {
        ...matchDescriptor(memberField, descriptors).toForm(memberField, ctx),
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
    title: schema.title,
    description: schema.description,
    properties: output,
  };
}

/** filter 投影：收集所有叶子字段平铺到顶层，交描述符 toFilter 处理。 */
export function projectFilter(
  schema: ModelSchema,
  locale: Locale,
  descriptors: FieldDescriptor[],
): IFormSchema {
  const ctx = createDescriptorCtx("filter", locale, descriptors);
  const properties: Record<string, IFieldSchema> = {};

  const walk = (props: Record<string, ModelFieldSchema> | undefined) => {
    if (!props) return;
    for (const [key, field] of Object.entries(props)) {
      // 复杂字段展开子字段，容器本身不进筛选区
      if (field.properties) {
        walk(field.properties);
        continue;
      }
      if (field.items && !Array.isArray(field.items) && field.items.properties) {
        walk(field.items.properties);
        continue;
      }
      if (field.display === "none") continue;
      // 是否进入筛选区由后端存储事实决定：filterable（缺省跟随 index）。
      // 这是能力约束——字段能不能高效筛选取决于是否有索引，前端无权声明。
      const xdb = field["x-database"];
      const filterable = xdb?.filterable ?? xdb?.index ?? false;
      if (!filterable) continue;
      const projected = matchDescriptor(field, descriptors).toFilter(field, key, ctx);
      if (projected) properties[key] = projected;
    }
  };
  walk(schema.properties);

  return { type: "object", properties };
}

/** table 投影：只取顶层字段，交描述符 toColumn 处理。 */
export function projectColumns(
  schema: ModelSchema,
  locale: Locale,
  descriptors: FieldDescriptor[],
): TableColumn[] {
  const ctx = createDescriptorCtx("table", locale, descriptors);
  return sortEntries(schema.properties ?? {})
    .filter(([, field]) => field.display !== "none")
    .filter(([, field]) => field["x-table"]?.visible !== false)
    .map(([key, field]) => matchDescriptor(field, descriptors).toColumn(field, key, ctx));
}

/** 单字段 → form 语义（供详情弹窗对单个字段渲染）。 */
export function projectField(
  field: ModelFieldSchema,
  locale: Locale,
  descriptors: FieldDescriptor[],
): IFieldSchema {
  const ctx = createDescriptorCtx("form", locale, descriptors);
  return matchDescriptor(field, descriptors).toForm(field, ctx);
}
