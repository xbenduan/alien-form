import type { ComponentMeta } from "../types";

/**
 * 组件静态元信息表：schema 转换（form/table/filter）只依赖这里的元数据，
 * 不依赖 React 组件实现，保证转换逻辑可在构建期与渲染期共用。
 */
export const componentMeta: Record<string, ComponentMeta> = {
  Input: { fieldType: "string", kind: "leaf" },
  Textarea: { fieldType: "string", kind: "leaf" },
  NumberInput: { fieldType: "number", kind: "leaf" },
  Select: { fieldType: "string", kind: "leaf" },
  MultiSelect: { fieldType: "string", kind: "leaf", multiValue: true },
  DateInput: { fieldType: "string", kind: "leaf" },
  Switch: { fieldType: "boolean", kind: "leaf" },
  Radio: { fieldType: "string", kind: "leaf" },
  CheckboxGroup: { fieldType: "string", kind: "leaf", multiValue: true },
  Rate: { fieldType: "number", kind: "leaf" },
  TagsInput: { fieldType: "string", kind: "leaf", multiValue: true },

  // 复杂字段：table 下折叠为摘要 + 详情按钮
  ObjectField: { fieldType: "object", kind: "complex" },
  ArrayCards: { fieldType: "array", kind: "complex" },

  // 布局容器：仅在 form 中包裹子字段，不占数据路径
  Card: { fieldType: "object", kind: "layout" },
  GridLayout: { fieldType: "object", kind: "layout" },
  FlexLayout: { fieldType: "object", kind: "layout" },
};

export function getComponentMeta(component?: string): ComponentMeta | undefined {
  return component ? componentMeta[component] : undefined;
}

export const LAYOUT_COMPONENTS = Object.keys(componentMeta).filter(
  (key) => componentMeta[key].kind === "layout",
);

export function isMultiValueComponent(component?: string): boolean {
  return Boolean(getComponentMeta(component)?.multiValue);
}

export function isComplexComponent(component?: string): boolean {
  return getComponentMeta(component)?.kind === "complex";
}
