import { lazy } from "react";
import type {
  ComponentMeta,
  ComponentOption,
  ComponentRegistry,
  ComponentRegistryEntry,
} from "../../types";

/**
 * 组件注册机：alien-form 组件库元信息的唯一来源。
 *
 * ！！！需要用到任一组件的配置（React 组件、别名、字段类型、默认 schema…）时，
 * 都必须走这张表；缺信息就在这里补，不要在别处另写一份配置。
 *
 * 每一项（ComponentRegistryEntry）承载：
 *  - alias：组件中文别名 → 编辑字段弹窗组件下拉展示名（buildComponentOptions）
 *  - component：React 组件（lazy 懒加载）→ fieldComponents（FormProvider）与 table 单元格渲染
 *  - fieldType / kind / multiValue / container：schema 投影与容器判断（transform.ts、schema.ts、buildComponentMeta）
 *  - schema：选择组件后自动带入的默认字段 schema（含 props / x-table / x-filter；type 与 component 绑定；不含 order）
 */
const registry: ComponentRegistry = {
  Input: {
    alias: "单行文本",
    component: lazy(() => import("./Input")),
    fieldType: "string",
    kind: "leaf",
    description: "",
    schema: {
      type: "string",
      title: "单行文本",
      description: undefined,
      default: undefined,
      component: "Input",
      props: { placeholder: "请输入" },
      required: false,
      disabled: false,
      display: "visible",
      "x-validate": "",
      "x-table": { width: 100, visible: true },
      "x-filter": { visible: true },
    },
  },

  Textarea: {
    alias: "多行文本",
    component: lazy(() => import("./Textarea")),
    fieldType: "string",
    kind: "leaf",
    schema: {
      type: "string",
      title: "多行文本",
      description: undefined,
      default: undefined,
      component: "Textarea",
      props: { placeholder: "请输入", rows: 4 },
      required: false,
      disabled: false,
      display: "visible",
      "x-validate": "",
      "x-table": { width: 160, visible: true },
      "x-filter": { visible: true },
    },
  },

  NumberInput: {
    alias: "数字",
    component: lazy(() => import("./NumberInput")),
    fieldType: "number",
    kind: "leaf",
    schema: {
      type: "number",
      title: "数字",
      description: undefined,
      default: undefined,
      component: "NumberInput",
      props: { placeholder: "请输入" },
      required: false,
      disabled: false,
      display: "visible",
      "x-validate": "",
      "x-table": { width: 100, visible: true },
      "x-filter": { visible: true },
    },
  },

  Select: {
    alias: "下拉单选",
    component: lazy(() => import("./Select")),
    fieldType: "string",
    kind: "leaf",
    schema: {
      type: "string",
      title: "下拉单选",
      description: undefined,
      default: undefined,
      dataSource: [
        { label: "选项 1", value: "1" },
        { label: "选项 2", value: "2" },
      ],
      component: "Select",
      props: { placeholder: "请选择" },
      required: false,
      disabled: false,
      display: "visible",
      "x-validate": "",
      "x-table": { width: 100, visible: true },
      "x-filter": { visible: true },
    },
  },

  MultiSelect: {
    alias: "下拉多选",
    component: lazy(() => import("./MultiSelect")),
    fieldType: "string",
    kind: "leaf",
    multiValue: true,
    schema: {
      type: "string",
      title: "下拉多选",
      description: undefined,
      default: undefined,
      dataSource: [
        { label: "多选 1", value: "1" },
        { label: "多选 2", value: "2" },
      ],
      component: "MultiSelect",
      props: { placeholder: "请选择" },
      required: false,
      disabled: false,
      display: "visible",
      "x-validate": "",
      "x-table": { width: 140, visible: true },
      "x-filter": { visible: true },
    },
  },

  DateInput: {
    alias: "日期",
    component: lazy(() => import("./DateInput")),
    fieldType: "string",
    kind: "leaf",
    schema: {
      type: "string",
      title: "日期",
      description: undefined,
      default: undefined,
      component: "DateInput",
      props: { placeholder: "请选择" },
      required: false,
      disabled: false,
      display: "visible",
      "x-validate": "",
      "x-table": { width: 120, visible: true },
      "x-filter": { visible: true },
    },
  },

  Switch: {
    alias: "开关",
    component: lazy(() => import("./Switch")),
    fieldType: "boolean",
    kind: "leaf",
    schema: {
      type: "boolean",
      title: "开关",
      description: undefined,
      default: undefined,
      component: "Switch",
      props: {},
      required: false,
      disabled: false,
      display: "visible",
      "x-validate": "",
      "x-table": { width: 80, visible: true },
      "x-filter": { visible: true },
    },
  },

  Radio: {
    alias: "单选按钮组",
    component: lazy(() => import("./Radio")),
    fieldType: "string",
    kind: "leaf",
    schema: {
      type: "string",
      title: "单选按钮组",
      description: undefined,
      default: undefined,
      dataSource: [
        { label: "选项 1", value: "1" },
        { label: "选项 2", value: "2" },
      ],
      component: "Radio",
      props: {},
      required: false,
      disabled: false,
      display: "visible",
      "x-validate": "",
      "x-table": { width: 120, visible: true },
      "x-filter": { visible: true },
    },
  },

  CheckboxGroup: {
    alias: "复选框组",
    component: lazy(() => import("./CheckboxGroup")),
    fieldType: "string",
    kind: "leaf",
    multiValue: true,
    schema: {
      type: "string",
      title: "复选框组",
      description: undefined,
      default: undefined,
      dataSource: [
        { label: "多选 1", value: "1" },
        { label: "多选 2", value: "2" },
      ],
      component: "CheckboxGroup",
      props: {},
      required: false,
      disabled: false,
      display: "visible",
      "x-validate": "",
      "x-table": { width: 140, visible: true },
      "x-filter": { visible: true },
    },
  },

  Rate: {
    alias: "评分",
    component: lazy(() => import("./Rate")),
    fieldType: "number",
    kind: "leaf",
    schema: {
      type: "number",
      title: "评分",
      description: undefined,
      default: undefined,
      component: "Rate",
      props: {},
      required: false,
      disabled: false,
      display: "visible",
      "x-validate": "",
      "x-table": { width: 120, visible: true },
      "x-filter": { visible: true },
    },
  },

  TagsInput: {
    alias: "标签",
    component: lazy(() => import("./TagsInput")),
    fieldType: "string",
    kind: "leaf",
    multiValue: true,
    schema: {
      type: "string",
      title: "标签",
      description: undefined,
      default: undefined,
      component: "TagsInput",
      props: { placeholder: "输入后回车" },
      required: false,
      disabled: false,
      display: "visible",
      "x-validate": "",
      "x-table": { width: 140, visible: true },
      "x-filter": { visible: true },
    },
  },

  // 复杂字段：table 下折叠为摘要 + 详情按钮，可嵌套子字段
  ObjectField: {
    alias: "对象分组",
    component: lazy(() => import("./ObjectField")),
    fieldType: "object",
    kind: "complex",
    container: true,
    schema: {
      type: "object",
      title: "对象分组",
      description: undefined,
      component: "ObjectField",
      props: { columns: 2, gutter: 16 },
      display: "visible",
      properties: {},
      "x-table": { width: 160, visible: true },
      "x-filter": { visible: false },
    },
  },

  ArrayCards: {
    alias: "对象数组",
    component: lazy(() => import("./ArrayCards")),
    fieldType: "array",
    kind: "complex",
    container: true,
    schema: {
      type: "array",
      title: "对象数组",
      description: undefined,
      component: "ArrayCards",
      props: { columns: 2, gutter: 16 },
      display: "visible",
      items: { type: "object", properties: {} },
      "x-table": { width: 160, visible: true },
      "x-filter": { visible: false },
    },
  },

  // 布局容器：仅在 form 中包裹子字段，不占数据路径
  GridLayout: {
    alias: "栅格布局",
    component: lazy(() => import("./GridLayout")),
    fieldType: "object",
    kind: "layout",
    schema: {
      type: "void",
      title: "栅格布局",
      description: undefined,
      component: "GridLayout",
      props: { columns: 2, gutter: 16 },
      display: "visible",
      properties: {},
    },
  },
};

/** 组件注册表（唯一元信息来源）。 */
export const componentRegistry: ComponentRegistry = registry;

export default registry;

/** 取单个组件的注册项。 */
export function getRegistryEntry(component?: string): ComponentRegistryEntry | undefined {
  return component ? registry[component] : undefined;
}

/** component 名 → React 组件（交给 @alien-form/react 的 FormProvider 消费）。 */
export const fieldComponents = Object.fromEntries(
  Object.entries(registry).map(([name, entry]) => [name, entry.component]),
) as Record<string, ComponentRegistryEntry["component"]>;

/**
 * 组件下拉选项：value=组件名，label=别名。
 * 消费方：编辑字段弹窗（FieldEditor）的组件选择下拉。
 * 可传 filter 只保留部分组件（如布局分组只用容器/布局组件）。
 */
export function buildComponentOptions(
  filter?: (entry: ComponentRegistryEntry, name: string) => boolean,
): ComponentOption[] {
  return Object.entries(registry)
    .filter(([name, entry]) => (filter ? filter(entry, name) : true))
    .map(([name, entry]) => ({ value: name, label: entry.alias }));
}

/** 布局组件名列表（kind === "layout"）。 */
export const LAYOUT_COMPONENTS = Object.keys(registry).filter(
  (name) => registry[name].kind === "layout",
);

/** 组件是否为多值组件（多选、标签、复选组）。 */
export function isMultiValueComponent(component?: string): boolean {
  return Boolean(getRegistryEntry(component)?.multiValue);
}

/** 组件是否为复杂字段（object / array）。 */
export function isComplexComponent(component?: string): boolean {
  return getRegistryEntry(component)?.kind === "complex";
}

/** 组件是否为可嵌套子字段的容器（object / array）。 */
export function isContainerComponent(component?: string): boolean {
  return Boolean(getRegistryEntry(component)?.container);
}

/**
 * 取组件的静态元信息（不含 React 依赖），供 schema 转换使用。
 * 由注册项派生，替代原独立维护的 componentMeta 表。
 */
export function getComponentMeta(component?: string): ComponentMeta | undefined {
  const entry = getRegistryEntry(component);
  if (!entry) return undefined;
  return { fieldType: entry.fieldType, kind: entry.kind, multiValue: entry.multiValue };
}

/** component 名 → 静态元信息（由注册表派生，schema 投影使用）。 */
export const componentMeta: Record<string, ComponentMeta> = Object.fromEntries(
  Object.entries(registry).map(([name, entry]) => [
    name,
    { fieldType: entry.fieldType, kind: entry.kind, multiValue: entry.multiValue },
  ]),
);

/** 组件默认字段 schema（选择组件后带入）；深拷贝避免污染注册表。 */
export function getDefaultFieldSchema(component: string): ComponentRegistryEntry["schema"] {
  const entry = registry[component];
  const schema = entry ? entry.schema : registry.Input.schema;
  return structuredClone(schema);
}
