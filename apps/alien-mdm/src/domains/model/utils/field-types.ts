import {
  buildComponentOptions,
  getFieldDefinition,
  isContainerComponent,
} from "../../../register/global/form/registry";

/**
 * 面向构建器的组件注册机薄封装（仅 UI 展示用途）。
 * 字段类型、默认 schema、投影和编辑器选项统一来自 FieldDefinition registry。
 */

/** 字段组件下拉选项：排除布局容器（由分组编辑器管理）。 */
export const FIELD_COMPONENT_OPTIONS = buildComponentOptions(
  (entry) => entry.authoring.kind !== "layout",
);

/** 布局分组可用的容器组件（kind === "layout"）。 */
export const GROUP_COMPONENT_OPTIONS = buildComponentOptions(
  (entry) => entry.authoring.kind === "layout",
);

/** 组件是否为可嵌套子字段的容器（object / array）。 */
export function isContainerField(component?: string): boolean {
  return isContainerComponent(component);
}

/** 组件的展示别名（字段列表 Tag 使用）。 */
export function componentAlias(component?: string): string {
  return getFieldDefinition(component)?.authoring.title ?? component ?? "";
}

/** 组件说明（编辑字段弹窗「字段 Schema」旁的 info 提示）。 */
export function componentDescription(component?: string): string {
  return getFieldDefinition(component)?.authoring.description ?? "";
}

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
