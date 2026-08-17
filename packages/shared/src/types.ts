import type { DataSourceItem, IFieldSchema, IFormSchema } from "@alien-form/core";
import type { FormConfig } from "@alien-form/react";

export type SchemaRecord = Record<string, unknown>;
export type SchemaHandlers = FormConfig["handlers"];
export type SchemaFormMode = "add" | "edit" | "detail";

export interface FormActions {
  onCancel?: () => void;
  onSubmit?: (
    values: SchemaRecord,
    mode: Exclude<SchemaFormMode, "detail">,
  ) => void | Promise<void>;
  onSubmitError?: (error: unknown) => void;
  submitText?: string;
  cancelText?: string;
}

export interface FilterProjection {
  schema: IFormSchema;
  defaultVisibleKeys?: string[];
}

export interface FilterActions {
  onSearch: (values: SchemaRecord) => void;
  onReset?: () => void;
  searchText?: string;
}

export interface TableInlineProjection {
  key: string;
  format?: string;
  dataSource?: DataSourceItem[];
}

export interface TableColumnProjection {
  key: string;
  title: string;
  width?: number;
  ellipsis?: boolean;
  format?: string;
  dataSource?: DataSourceItem[];
  inline?: TableInlineProjection[];
  expandable?: boolean;
  sortable?: boolean;
  visible?: boolean;
  defaultVisible?: boolean;
  order: number;
  field: IFieldSchema;
  type?: IFieldSchema["type"];
}

export interface DetailProjection {
  schema: IFormSchema;
  values?: SchemaRecord;
}
