import type { DataSourceItem } from "@alien-form/core";
import type { CmsFieldSchema, ValueFormat } from "../types/schema";

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

export interface FilterFieldProjection {
  key: string;
  title: string;
  type?: string;
  component?: string;
  operator: string;
  props?: Record<string, unknown>;
  dataSource?: DataSourceItem[];
  defaultVisible: boolean;
  order: number;
}

export interface DetailItemProjection {
  key: string;
  title: string;
  format?: ValueFormat;
  dataSource?: DataSourceItem[];
  type?: string;
  order: number;
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
