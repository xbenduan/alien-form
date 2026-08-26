import { lazy } from "react";
import type {
  ComponentMeta,
  ComponentOption,
  ComponentRegistry,
  ComponentRegistryEntry,
} from "../../../types/shared";

/**
 * 组件注册机：alien-form 组件库元信息的唯一来源。
 */
const registry: ComponentRegistry = {
  Input: {
    alias: "单行文本",
    component: lazy(() => import("./Input")),
    fieldType: "string",
    kind: "leaf",
    description:
      "单行文本输入框，适用于姓名、标题等短文本。可在 props.placeholder 设置占位提示；用 x-validate 配置校验表达式。",
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
    },
  },

  Textarea: {
    alias: "多行文本",
    component: lazy(() => import("./Textarea")),
    fieldType: "string",
    kind: "leaf",
    description:
      "多行文本域，适用于备注、简介等长文本。可用 props.rows 设置默认行数；props.placeholder 设置占位提示。",
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
    },
  },

  NumberInput: {
    alias: "数字",
    component: lazy(() => import("./NumberInput")),
    fieldType: "number",
    kind: "leaf",
    description:
      "数字输入框，适用于金额、数量、年龄等数值。可用 props.min / props.max 限制取值范围。",
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
    },
  },

  Select: {
    alias: "下拉单选",
    component: lazy(() => import("./Select")),
    fieldType: "string",
    kind: "leaf",
    description:
      "下拉单选框，适用于枚举类字段（状态、分类等）。dataSource 直接配置静态候选项 [{label,value}]；远程候选项通过 props.service 声明 model、valueKey 和 labelKey。",
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
    },
  },

  DateInput: {
    alias: "日期",
    component: lazy(() => import("./DateInput")),
    fieldType: "string",
    kind: "leaf",
    description: "日期选择器，值以字符串（YYYY-MM-DD）存储。适用于生日、生效日期等。",
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
    },
  },

  TreeSelect: {
    alias: "树形单选",
    component: lazy(() => import("./TreeSelect")),
    fieldType: "string",
    kind: "leaf",
    description:
      "树形单选：从一个模型按「父字段 → 自身字段」拼成层级树供选择，适合选自连接结构的上级节点（如部门的上级部门）。取数配置放在 props：treeModel（取数模型）、treeIdField（节点标识，即回填值）、treeLabelField（展示字段）、treeParentField（上级标识，缺省 parentCode）。自连接连接键为业务编码而非 id，不声明外键。",
    schema: {
      type: "string",
      title: "树形单选",
      description: undefined,
      default: undefined,
      component: "TreeSelect",
      props: {
        placeholder: "请选择",
        treeModel: "",
        treeIdField: "id",
        treeLabelField: "id",
        treeParentField: "parentCode",
      },
      required: false,
      disabled: false,
      display: "visible",
      "x-validate": "",
      "x-table": { width: 160, visible: true },
    },
  },

  // 复杂字段：table 下折叠为摘要 + 详情按钮，可嵌套子字段
  ObjectField: {
    alias: "对象分组",
    component: lazy(() => import("./ObjectField")),
    fieldType: "object",
    kind: "complex",
    container: true,
    description:
      "对象分组：把若干子字段收敛为一个嵌套对象（值为对象）。子字段在字段树中拖入本节点管理；props.columns / props.gutter 控制栅格列数与间距。table 中折叠为摘要 + 详情按钮。",
    schema: {
      type: "object",
      title: "对象分组",
      description: undefined,
      component: "ObjectField",
      props: { columns: 2, gutter: 16 },
      display: "visible",
      properties: {},
      "x-table": { width: 160, visible: true },
    },
  },

  ArrayCards: {
    alias: "对象数组",
    component: lazy(() => import("./ArrayCards")),
    fieldType: "array",
    kind: "complex",
    container: true,
    description:
      "对象数组：以卡片列表管理一组同构对象（值为数组），支持增删行。子字段（每行的结构）在字段树中拖入本节点管理；props.columns / props.gutter 控制每行栅格。",
    schema: {
      type: "array",
      title: "对象数组",
      description: undefined,
      component: "ArrayCards",
      props: { columns: 2, gutter: 16 },
      display: "visible",
      items: { type: "object", properties: {} },
      "x-table": { width: 160, visible: true },
    },
  },

  // 布局容器：仅在 form 中包裹子字段，不占数据路径
  GridLayout: {
    alias: "栅格布局",
    component: lazy(() => import("./GridLayout")),
    fieldType: "object",
    kind: "layout",
    description:
      "栅格布局容器：仅在表单中把若干字段按栅格排布，不占用数据路径（不产生独立取值）。通过分组编辑器使用，props.columns / props.gutter 控制列数与间距。",
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
  return { fieldType: entry.fieldType, kind: entry.kind };
}

/** component 名 → 静态元信息（由注册表派生，schema 投影使用）。 */
export const componentMeta: Record<string, ComponentMeta> = Object.fromEntries(
  Object.entries(registry).map(([name, entry]) => [
    name,
    { fieldType: entry.fieldType, kind: entry.kind },
  ]),
);

/** 组件默认字段 schema（选择组件后带入）；深拷贝避免污染注册表。 */
export function getDefaultFieldSchema(component: string): ComponentRegistryEntry["schema"] {
  const entry = registry[component];
  const schema = entry ? entry.schema : registry.Input.schema;
  return structuredClone(schema);
}
