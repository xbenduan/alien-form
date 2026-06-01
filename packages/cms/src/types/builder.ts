import type { ModelActionOpenMode } from "./schema";

export type BuilderFieldType = "string" | "number" | "boolean" | "object" | "void" | "array";

export type BuilderComponentName =
  | "Input"
  | "Textarea"
  | "NumberInput"
  | "Select"
  | "Switch"
  | "DateInput"
  | "Radio"
  | "CheckboxGroup"
  | "Rate"
  | "TagsInput"
  | "SectionCard"
  | "ArrayCards";

export type BuilderReactionTarget =
  | "value"
  | "display"
  | "disabled"
  | "required"
  | "title"
  | "description"
  | "props"
  | "dataSource";

export interface ModelBuilderReactionDraft {
  id: string;
  target: BuilderReactionTarget;
  handler: string;
  paramsText: string;
}

export interface ModelBuilderFieldDraft {
  id: string;
  key: string;
  title: string;
  type: BuilderFieldType;
  component: BuilderComponentName;
  decorator?: "FormItem";
  required: boolean;
  defaultValueText: string;
  propsText: string;
  dataSourceText: string;
  filterVisible: boolean;
  filterDefaultVisible: boolean;
  tableVisible: boolean;
  tableWidthText: string;
  tableEllipsis: boolean;
  detailVisible: boolean;
  reactions: ModelBuilderReactionDraft[];
  children?: ModelBuilderFieldDraft[];
  arrayMode?: "tags" | "object";
  itemTitle?: string;
}

export interface ModelBuilderDraft {
  modelName: string;
  title: string;
  subtitle: string;
  description: string;
  singularLabel: string;
  pluralLabel: string;
  defaultPageSize: number;
  defaultFilterCount: number;
  openMode: Partial<Record<"add" | "edit" | "detail", ModelActionOpenMode>>;
  fields: ModelBuilderFieldDraft[];
}
