import type { DataSourceItem } from "@alien-form/core";
import type { CmsFieldSchema, CmsModelSchema, ValueFormat } from "../types/schema";

export interface TableColumnProjection {
  key: string;
  title: string;
  width?: number;
  ellipsis?: boolean;
  format?: ValueFormat;
  dataSource?: DataSourceItem[];
  type?: string;
  order: number;
  inline?: string[];
  expandable?: boolean;
  field: CmsFieldSchema;
}

export interface FilterSchemaProjection {
  schema: CmsModelSchema;
  defaultVisibleKeys: string[];
}

export interface MobileCardProjection {
  titleField: string;
  subtitleField?: string;
  tagField?: string;
  summaryFields: Array<{
    key: string;
    title: string;
    format?: ValueFormat;
    dataSource?: DataSourceItem[];
  }>;
}
