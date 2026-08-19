import type { GroupConfig } from "@alien-form/shared";
import type { ModelMeta, ModelSchema, OpenMode } from "../../../services";

export type { ModelMeta, ModelSchema, OpenMode };

/** 构建器支持的字段类型。 */
export type BuilderFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "select"
  | "multiSelect"
  | "tags"
  | "object"
  | "array";

/** 字段草稿：模型构建器编辑态的单个字段。 */
export interface FieldDraft {
  id: string;
  key: string;
  title: string;
  type: BuilderFieldType;
  component: string;
  placeholder: string;
  jsonEnabled: boolean;
  schemaJsonText: string;
  required: boolean;
  tableWidthText: string;
  tableVisible: boolean;
  /** 复杂字段（object/array）的子字段。 */
  children?: FieldDraft[];
}

/** 分组草稿。 */
export interface GroupDraft {
  id: string;
  title: string;
  component: string;
  keys: string[];
  /** GridLayout 单个字段占用的 24 栅格跨度，默认 12（一行两个）。 */
  gridSpan: number;
}

/** 模型草稿：构建器的完整编辑态。 */
export interface ModelDraft {
  name: string;
  title: string;
  subtitle: string;
  description: string;
  singularLabel: string;
  pluralLabel: string;
  defaultPageSize: number;
  filterCount: number;
  openMode: Record<"add" | "edit" | "detail", OpenMode>;
  fields: FieldDraft[];
  groups: GroupDraft[];
}

export type { GroupConfig };
