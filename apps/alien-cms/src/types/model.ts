import type { DataSourceItem, IFieldSchema, IFormSchema } from '@alien-form/react';
import type { ReactNode } from 'react';

export type DrawerMode = 'closed' | 'add' | 'edit' | 'detail';
export type ModelRecord = Record<string, unknown> & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type FilterOperator = 'contains' | 'eq' | 'includes';
export type ValueFormat = 'boolean' | 'date' | 'dateTime' | 'status';

export interface CmsFieldUiMeta {
  filter?: {
    visible?: boolean;
    defaultVisible?: boolean;
    operator?: FilterOperator;
  };
  table?: {
    visible?: boolean;
    width?: number;
    ellipsis?: boolean;
    format?: ValueFormat;
  };
  form?: {
    modes?: Array<'add' | 'edit'>;
  };
  detail?: {
    visible?: boolean;
    format?: ValueFormat;
  };
}

export interface CmsFieldSchema extends IFieldSchema {
  'x-cms'?: CmsFieldUiMeta;
}

export interface CmsModelMeta {
  name: string;
  title?: string;
  subtitle?: string;
  description?: string;
  singularLabel?: string;
  pluralLabel?: string;
  primaryField?: string;
  defaultFilterCount?: number;
  defaultPageSize?: number;
}

export interface CmsModelSchema extends Omit<IFormSchema, 'properties'> {
  properties?: Record<string, CmsFieldSchema>;
  'x-model'?: CmsModelMeta;
}

export interface ModelSummary {
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
}

export interface FilterFieldProjection {
  key: string;
  title: string;
  type?: string;
  component?: string;
  operator: FilterOperator;
  props?: Record<string, unknown>;
  dataSource?: DataSourceItem[];
  defaultVisible: boolean;
  order: number;
}

export interface TableColumnProjection {
  key: string;
  title: string;
  width?: number;
  ellipsis?: boolean;
  format?: ValueFormat;
  dataSource?: DataSourceItem[];
  type?: string;
  order: number;
}

export interface DetailItemProjection {
  key: string;
  title: string;
  format?: ValueFormat;
  dataSource?: DataSourceItem[];
  type?: string;
  order: number;
  render?: (value: unknown, record: ModelRecord) => ReactNode;
}

export interface DataProvider {
  list(params: {
    model: string;
    filters?: Record<string, unknown>;
    pagination?: { current: number; pageSize: number };
    sorter?: { field?: string; order?: 'ascend' | 'descend' };
  }): Promise<{ list: ModelRecord[]; total: number }>;
  detail(params: { model: string; id: string }): Promise<ModelRecord>;
  create(params: { model: string; values: Record<string, unknown> }): Promise<ModelRecord>;
  update(params: { model: string; id: string; values: Record<string, unknown> }): Promise<ModelRecord>;
  remove(params: { model: string; id: string }): Promise<void>;
}
