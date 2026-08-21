import {
  buildComponentOptions,
  getDefaultFieldSchema,
  getRegistryEntry,
  isContainerComponent,
} from "@alien-form/shared";
import type { ModelFieldSchema } from "../../../services";

/**
 * 字段类型元信息统一走 @alien-form/shared 的组件注册机，
 * 这里只做「面向构建器的薄封装」，不再维护独立的类型 → 组件映射，
 * 也不再由 component/type 反推构建器类型（type 与 component 绑定，交给组件本身表达）。
 */

/**
 * 字段组件下拉选项（value=组件名，label=注册别名）：供编辑字段弹窗的组件选择。
 * 排除布局容器（kind==="layout"，如 GridLayout）——布局由分组编辑器管理，不作为数据字段。
 */
export const FIELD_COMPONENT_OPTIONS = buildComponentOptions((entry) => entry.kind !== "layout");

/** 布局分组可用的容器组件（注册机中 kind === "layout"）。 */
export const GROUP_COMPONENT_OPTIONS = buildComponentOptions((entry) => entry.kind === "layout");

/** 组件是否为可嵌套子字段的容器（object / array）。 */
export function isContainerField(component?: string): boolean {
  return isContainerComponent(component);
}

/** 组件的展示别名（字段列表 Tag 使用），未注册时回退到组件名。 */
export function componentAlias(component?: string): string {
  return getRegistryEntry(component)?.alias ?? component ?? "";
}

/** 新建字段时的默认字段 schema（默认单行文本）。 */
export function defaultFieldSchema(component = "Input"): ModelFieldSchema {
  return getDefaultFieldSchema(component) as ModelFieldSchema;
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
