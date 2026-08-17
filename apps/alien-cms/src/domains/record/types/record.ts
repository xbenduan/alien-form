export type {
  CmsFieldSchema,
  CmsFieldUiMeta,
  CmsModelMeta,
  CmsModelSchema,
  ModelSummary,
  ModelActionKind,
  ModelActionOpenMode,
  ValueFormat,
} from "../../model";
export type {
  ModelRecord,
  ModelRecord as BaseModelRecord,
} from "../../../data";
export type { FilterOperator } from "../../../data/types/common";
export type { TableColumnProjection } from "@alien-form/shared";
export type { FilterFieldProjection } from "../projection";
import type {
  CmsModelSchema,
  ModelActionKind,
} from "../../model";
import type { ModelRecord } from "../../../data";

export type ModelActionMode = 'closed' | ModelActionKind;

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
