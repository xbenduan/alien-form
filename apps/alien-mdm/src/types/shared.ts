import type { DataSourceItem, IFieldSchema, IFormSchema } from "@alien-form/react";
import type { UiDefinition, UiNode } from "@alien-form/engine";
import type { ReactNode } from "react";

/** 渲染模式：新增 / 编辑 / 详情（只读）。 */
export type FieldMode = "add" | "edit" | "detail";

/** 注入 alien-form FormInstance.scope 的页面场景。 */
export interface FormScope {
  [key: string]: unknown;
  mode?: FieldMode;
}

export type SchemaRecord = Record<string, unknown>;

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
}

/**
 * 后端列的物理存储类型（与 alien-server ColumnType 对齐）。
 * alien-form 核心只有 string/number/boolean，字段类型以后端可选类型为准，
 * 再映射成前端的 schema type。
 */
export type ColumnType = "text" | "integer" | "real" | "boolean" | "json";

/** 编辑字段时「数据库类型」下拉的选项。 */
export const COLUMN_TYPE_OPTIONS: ReadonlyArray<{ label: string; value: ColumnType }> = [
  { label: "文本 text", value: "text" },
  { label: "整数 integer", value: "integer" },
  { label: "小数 real", value: "real" },
  { label: "布尔 boolean", value: "boolean" },
  { label: "JSON json", value: "json" },
];

/** 后端列类型 → 前端 schema type。 */
export function columnTypeToFieldType(type?: ColumnType): ComponentMeta["fieldType"] | undefined {
  switch (type) {
    case "text":
      return "string";
    case "integer":
    case "real":
      return "number";
    case "boolean":
      return "boolean";
    case "json":
      return "object";
    default:
      return undefined;
  }
}

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
  selectMode?: "multiple" | "tags";
  dataSource?: DataSourceItem[];
  /** 远程数据源声明：组件通过注入的 request 自取选项。 */
  service?: {
    model: string;
    valueKey: string;
    labelKey: string;
  };

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

/** 布局（ui）组件的编辑期元信息：父子约束、props 行数、slot 声明。 */
export interface UiAuthoring {
  kind: "layout" | "content" | "action";
  parent?: string;
  children: boolean;
  props: UiPropsConfig;
  create(): UiNode;
}

/** props JSON 编辑器配置：`show: false` 表示该组件不暴露 props 编辑。 */
export type UiPropsConfig = { show: false } | { show?: true; rows: number };

export type UiComponentDefinition = UiDefinition<any, UiAuthoring>;
