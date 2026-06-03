export type {
  CmsFieldSchema,
  CmsFieldUiMeta,
  CmsModelMeta,
  CmsModelSchema,
  ModelSummary,
  ModelActionKind,
  ModelActionOpenMode,
  ModelRecord,
  ModelRecord as BaseModelRecord,
  ValueFormat,
  FilterOperator,
} from '@alien-form/cms';
import type { CmsFieldSchema, CmsModelSchema, ModelActionKind, ModelRecord } from '@alien-form/cms';

export type ModelActionMode = 'closed' | ModelActionKind;

export interface TableColumnProjection {
  key: string;
  title: string;
  width?: number;
  ellipsis?: boolean;
  format?: string;
  dataSource?: CmsFieldSchema['dataSource'];
  inline?: string[];
  expandable?: boolean;
  order: number;
  field: CmsFieldSchema;
  type?: CmsFieldSchema['type'];
}

export interface FilterFieldProjection {
  key: string;
  title: string;
  component?: string;
  operator?: string;
  props?: Record<string, unknown>;
  dataSource?: Array<{ label: string; value: unknown }>;
  defaultVisible: boolean;
  order: number;
  field: CmsFieldSchema;
}

export interface RecordRouteState {
  mode: ModelActionMode;
  recordId?: string;
}

export type ModelSource = 'static' | 'runtime';
export type LocalSchemaRecordSource = 'runtime' | 'static-override';

export interface RuntimeModelSchemaRecord {
  id: string;
  modelName: string;
  title: string;
  subtitle?: string;
  description?: string;
  schema?: CmsModelSchema;
  source: LocalSchemaRecordSource;
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeModelRecord extends ModelRecord {
  modelName: string;
}
