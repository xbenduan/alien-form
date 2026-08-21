import type { DataSourceItem, FormConfig, IFieldSchema, IFormSchema } from "@alien-form/react";
import type { ComponentType, LazyExoticComponent, ReactNode } from "react";

/** 渲染模式：新增 / 编辑 / 详情（只读）。 */
export type FieldMode = "add" | "edit" | "detail";

export type SchemaRecord = Record<string, unknown>;
export type SchemaHandlers = FormConfig["handlers"];

/**
 * 分组配置：把若干顶层字段收进 GridLayout 布局容器，
 * 只影响 form 的渲染，不改变 table / filter 的字段来源。
 */
export interface GroupConfig {
  component: string;
  keys: string[];
  title?: string;
  props?: Record<string, unknown>;
}

/**
 * 配置态 schema：一份 schema 同时投影出 form / table / filter 三个场景。
 * 字段沿用 alien-form 的 IFieldSchema，额外允许 `component`（已在 IFieldSchema 中）。
 */
export interface SchemaConfig extends IFormSchema {
  group?: GroupConfig[];
}

export type FieldSchema = IFieldSchema;

/** 递归收集叶子字段的结果项。 */
export interface LeafField {
  key: string;
  field: IFieldSchema;
}

/** 组件在各场景下的静态元信息（不含 React 依赖，供 schema 转换使用）。 */
export type FieldKind = "leaf" | "complex" | "layout";

export interface ComponentMeta {
  fieldType: "string" | "number" | "boolean" | "object" | "array";
  kind: FieldKind;
  /** 值为数组的多值组件（多选、标签、复选组），内部以 JSON 字符串承载。 */
  multiValue?: boolean;
}

/**
 * 注册项默认 schema：作为“选择组件后自动带入”的字段配置模板。
 * 覆盖单个组件能填写的全部字段（含 props / x-table / x-filter），
 * 唯独不含 order（order 由拖拽排序生成，不应有默认值）。
 * 消费方：
 *  - register/index.ts 每个组件的 `schema` 字段
 *  - apps/alien-cms 编辑字段弹窗（FieldEditor）选择组件时带入到 JSON 编辑框
 *  - apps/alien-cms schema-to-draft.createFieldDraft 生成新字段草稿
 */
export interface RegistryFieldSchema extends IFieldSchema {
  /** table 列展示元信息（对应 CMS 的 x-table）。 */
  "x-table"?: { width?: number; visible?: boolean; ellipsis?: boolean; sortable?: boolean };
  /** filter 展示元信息。 */
  "x-filter"?: { visible?: boolean };
}

/**
 * 组件注册项：组件库的唯一元信息来源。
 * “需要用到任一组件的配置时都走这张表”，新增元信息只在这里补充。
 * 各字段消费方：
 *  - alias：编辑字段弹窗组件下拉的展示名（buildComponentOptions → FieldEditor 的组件 Select）
 *  - component：交给 @alien-form/react FormProvider 渲染的 React 组件（fieldComponents 由此派生）
 *  - kind / fieldType / multiValue：schema 投影（transform.ts、schema.ts、buildComponentMeta）
 *  - schema：选择组件后带入的默认字段 schema（见 RegistryFieldSchema）
 *  - container：是否为可嵌套子字段的容器（object / array），供字段树与编辑器判断
 */
export interface ComponentRegistryEntry {
  /** 组件别名（中文展示名），如 CheckboxGroup 的 alias 为「复选框组」。 */
  alias: string;
  /** React 组件实例（lazy 懒加载，渲染处需包裹 Suspense）。 */
  component: LazyExoticComponent<ComponentType<FieldComponentProps>>;
  /** 字段基础类型，与 component 绑定；多值组件对外降级为 string。 */
  fieldType: ComponentMeta["fieldType"];
  /** 组件形态：叶子 / 复杂（object、array）/ 布局容器。 */
  kind: FieldKind;
  /** 值为数组的多值组件（多选、标签、复选组），内部以 JSON 字符串承载。 */
  multiValue?: boolean;
  /** 是否为可容纳子字段的容器（object / array 复杂字段）。 */
  container?: boolean;
  /** 选择该组件时带入的默认字段 schema 模板。 */
  schema: RegistryFieldSchema;
  /** 组件描述。 在编辑字段弹窗中展示。 */
  description?: string;
}

/** 组件注册表：component 名 → 注册项。 */
export type ComponentRegistry = Record<string, ComponentRegistryEntry>;

/** 编辑字段弹窗组件下拉的选项。 */
export interface ComponentOption {
  value: string;
  label: string;
}

/** 统一的字段组件入参：leaf / complex / layout 组件都消费这套 props 的子集。 */
export interface FieldComponentProps {
  value?: unknown;
  onChange?: (next: unknown) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  mode?: FieldMode;
  dataSource?: DataSourceItem[];

  /** 复杂字段在 table 单元格中渲染时为 true：展示摘要 + 详情按钮。 */
  isTable?: boolean;
  /** 复杂字段自身的 schema，用于详情弹窗渲染。 */
  schema?: IFieldSchema;
  title?: string;
  description?: string;

  /** 由 @alien-form/react 注入的容器渲染上下文。 */
  children?: ReactNode;
  fields?: Record<string, ReactNode>;
  field?: unknown;
  /** 数组字段每行已渲染的子节点（由 @alien-form/react 注入）。 */
  rows?: ReactNode[];
  rowNodes?: Array<{ id?: string | number }>;
  onAdd?: (initialValues?: unknown) => void;
  onRemove?: (index: number) => void;

  /** 组件额外的透传属性（如 Textarea 的 rows、Layout 的 columns/gutter）。 */
  [key: string]: unknown;
}

/** table 列定义（由 buildTableColumns 产出）。 */
export interface TableColumn {
  key: string;
  title: string;
  width?: number;
  ellipsis: boolean;
  sortable: boolean;
  /** 复杂字段（object / array）走详情弹窗渲染。 */
  complex: boolean;
  component?: string;
  dataSource?: DataSourceItem[];
  /** 已转换为 form 语义的字段 schema，用于详情弹窗。 */
  field: IFieldSchema;
}
