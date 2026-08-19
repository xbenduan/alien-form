import type {
  DataSourceItem,
  FormConfig,
  IFieldSchema,
  IFormSchema,
} from "@alien-form/react";
import type { ReactNode } from "react";

/** 渲染模式：新增 / 编辑 / 详情（只读）。 */
export type FieldMode = "add" | "edit" | "detail";

export type SchemaRecord = Record<string, unknown>;
export type SchemaHandlers = FormConfig["handlers"];

/**
 * 分组配置：把若干顶层字段收进一个布局容器（如 Card），
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
