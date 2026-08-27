import type { IFieldSchema, IFormSchema } from "@alien-form/core";
import type { FormComponentDefinition, UiNode } from "@alien-form/engine";
import type { ComponentType, LazyExoticComponent } from "react";
import type {
  ComponentMeta,
  FieldComponentProps,
  GroupConfig,
  TableColumn,
} from "@app-types/shared";

export type Locale = "zh" | "en" | (string & {});
export type ModelPageScene = "list" | "add" | "edit" | "detail";
export type OpenMode = "page" | "drawer" | "modal";
export type ModelGroup = "system" | "other";

export interface TableFieldMeta {
  width?: number;
  ellipsis?: boolean;
  sortable?: boolean;
  visible?: boolean;
}

export interface XDatabaseMeta {
  type?: string;
  nullable?: boolean;
  default?: string | number | boolean;
  unique?: boolean;
  index?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  relation?: "many-to-one" | "many-to-many";
  target?: string;
  through?: string;
}

export interface ModelMeta {
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  group?: ModelGroup;
  singularLabel: string;
  pluralLabel: string;
  defaultPageSize: number;
  filterCount?: number;
  openMode: Record<"add" | "edit" | "detail", OpenMode>;
}

export interface ModelFieldSchema extends Omit<
  IFieldSchema,
  "dataSource" | "properties" | "items"
> {
  key?: string;
  "x-table"?: TableFieldMeta;
  "x-database"?: XDatabaseMeta;
  dataSource?: IFieldSchema["dataSource"] | { plugin: string; [key: string]: unknown };
  properties?: Record<string, ModelFieldSchema>;
  items?: ModelFieldSchema | ModelFieldSchema[];
}

export type I18nDict = Record<string, Partial<Record<Locale, string>>>;

export interface ModelSchema extends Omit<IFormSchema, "properties" | "x-layout"> {
  meta: ModelMeta;
  properties: Record<string, ModelFieldSchema>;
  group?: GroupConfig[];
  "x-layout": UiNode;
  i18n?: I18nDict;
  constants?: Record<string, unknown>;
}

export interface FieldDraft {
  id: string;
  fields: ModelFieldSchema;
  children?: FieldDraft[];
}

export interface GroupDraft {
  id: string;
  title: string;
  component: string;
  keys: string[];
  gridSpan: number;
}

export interface ModelDraft {
  name: string;
  title: string;
  subtitle: string;
  description: string;
  group: ModelGroup;
  singularLabel: string;
  pluralLabel: string;
  defaultPageSize: number;
  filterCount: number;
  openMode: Record<"add" | "edit" | "detail", OpenMode>;
  fields: FieldDraft[];
  groups: GroupDraft[];
  layout: UiNode;
  i18n?: I18nDict;
  constants?: Record<string, unknown>;
}

export interface ProjectionContext {
  scene: "form" | "filter" | "table";
  locale: Locale;
  projectProperties(properties: Record<string, ModelFieldSchema>): Record<string, IFieldSchema>;
}

export interface ModelFieldAuthoring {
  kind: "leaf" | "complex" | "layout";
  children?: "properties" | "items";
  create(): ModelFieldSchema;
}

export interface ModelFieldProjection {
  toForm(field: ModelFieldSchema, context: unknown): IFieldSchema;
  toFilter(field: ModelFieldSchema, key: string, context: unknown): IFieldSchema | undefined;
  toColumn(field: ModelFieldSchema, key: string, context: unknown): TableColumn;
}

export type ModelFieldDefinition = FormComponentDefinition<unknown, ModelFieldAuthoring> & {
  fieldType: ComponentMeta["fieldType"];
  projection: ModelFieldProjection;
};

/** 已注册的字段组件定义：在 ModelFieldDefinition 基础上绑定具体的 React 组件。 */
export interface RegisteredFieldDefinition extends ModelFieldDefinition {
  component: LazyExoticComponent<ComponentType<FieldComponentProps>>;
  fieldType: ComponentMeta["fieldType"];
}
