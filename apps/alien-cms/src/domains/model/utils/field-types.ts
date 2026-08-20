import type { BuilderFieldType } from "../types";

interface FieldTypeMeta {
  label: string;
  /** 默认组件名（对应 @alien-form/shared 的组件注册表）。 */
  component: string;
  /** alien-form schema 的基础 type；undefined 表示由组件推断（如多值降级为 string）。 */
  schemaType?: "string" | "number" | "boolean" | "object" | "array";
  /** 是否为容器字段（object / array）。 */
  container?: boolean;
}

/** 构建器字段类型 → schema 组件与类型的映射。 */
export const FIELD_TYPE_META: Record<BuilderFieldType, FieldTypeMeta> = {
  string: { label: "单行文本", component: "Input", schemaType: "string" },
  number: { label: "数字", component: "NumberInput", schemaType: "number" },
  boolean: { label: "开关", component: "Switch", schemaType: "boolean" },
  date: { label: "日期", component: "DateInput", schemaType: "string" },
  select: { label: "下拉单选", component: "Select", schemaType: "string" },
  multiSelect: { label: "下拉多选", component: "MultiSelect" },
  tags: { label: "标签", component: "TagsInput" },
  object: { label: "对象分组", component: "ObjectField", schemaType: "object", container: true },
  array: { label: "对象数组", component: "ArrayCards", schemaType: "array", container: true },
};

export const FIELD_TYPE_OPTIONS = Object.entries(FIELD_TYPE_META).map(([value, meta]) => ({
  value: value as BuilderFieldType,
  label: meta.label,
}));

export function isContainerType(type: BuilderFieldType): boolean {
  return Boolean(FIELD_TYPE_META[type].container);
}

/** 字段组件的默认占位提示。 */
export function getDefaultPlaceholder(type: BuilderFieldType): string {
  if (type === "select" || type === "multiSelect" || type === "date") return "请选择";
  if (isContainerType(type) || type === "boolean") return "";
  return "请输入";
}

/** 布局分组可用的容器组件。 */
export const GROUP_COMPONENT_OPTIONS = [
  { value: "GridLayout", label: "栅格 (GridLayout)" },
];

/** 打开方式选项。 */
export const OPEN_MODE_OPTIONS = [
  { value: "page", label: "整页" },
  { value: "drawer", label: "抽屉" },
  { value: "modal", label: "弹窗" },
];

/** 模型分组选项（落地页 Segmented 归类用）。 */
export const MODEL_GROUP_OPTIONS = [
  { value: "system", label: "系统" },
  { value: "other", label: "其他" },
];
