export type {
  CmsFieldSchema,
  CmsFieldUiMeta,
  CmsModelMeta,
  CmsModelSchema,
  ModelSummary,
  FilterSchemaProjection,
  TableColumnProjection,
  ModelActionMode,
  ModelActionKind,
  ModelActionOpenMode,
  ModelRecord,
  ModelRecord as BaseModelRecord,
  ValueFormat,
  FilterOperator,
} from '@alien-form/cms';
import type { CmsModelSchema, ModelActionMode, ModelRecord } from '@alien-form/cms';

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
