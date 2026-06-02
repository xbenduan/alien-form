/**
 * @alien-form/cms — Framework-agnostic CMS business core
 *
 * Provides types, data providers, stores, and schema projections.
 * UI frameworks (React/Vue/Solid) only need to
 * subscribe to store signals and render.
 */

// ─── Types ────────────────────────────────────────────────────
export type {
  Pagination,
  PaginatedResult,
  Sorter,
  FilterOperator,
  FilterItem,
  MutationResult,
} from "./types/common";

export type {
  ValueFormat,
  ModelActionKind,
  ModelActionOpenMode,
  CmsFieldTableMeta,
  CmsFieldFormMeta,
  CmsFieldDetailMeta,
  CmsFieldMobileMeta,
  CmsFieldUiMeta,
  CmsFieldSchema,
  CmsModelMeta,
  CmsModelSchema,
  ModelSummary,
  SchemaListParams,
  SchemaDetailParams,
  SchemaCreateParams,
  SchemaUpdateParams,
  SchemaDeleteParams,
  SchemaListResult,
  SchemaDetailResult,
  SchemaCreateResult,
  SchemaUpdateResult,
  SchemaDeleteResult,
} from "./types/schema";

export type {
  ModelRecord,
  RecordListParams,
  RecordDetailParams,
  RecordCreateParams,
  RecordUpdateParams,
  RecordDeleteParams,
  RecordBatchDeleteParams,
  RecordListResult,
  RecordDetailResult,
  RecordCreateResult,
  RecordUpdateResult,
  RecordDeleteResult,
  RecordBatchDeleteResult,
} from "./types/record";

export type {
  AlienCmsConfig,
  AuthType,
  AuthConfig,
  OAuth2Config,
  ApiKeyConfig,
  BasicAuthConfig,
  BearerConfig,
  CustomAuthConfig,
  EndpointConfig,
  AdapterConfig,
  SchemaSourceConfig,
  ConnectionOptions,
} from "./types/config";

export type {
  ModelBuilderDraft,
  ModelBuilderFieldDraft,
  ModelBuilderReactionDraft,
  BuilderFieldType,
  BuilderComponentName,
  BuilderReactionTarget,
} from "./types/builder";

// ─── Provider Interfaces ──────────────────────────────────────
export type { SchemaProvider } from "./provider/schema-provider";
export type { RecordProvider } from "./provider/record-provider";

// ─── Stores ───────────────────────────────────────────────────
export { ModelPageStore } from "./store/model-page-store";
export type { ModelPageStoreConfig, ModelActionMode } from "./store/model-page-store";
export { ModelBuilderStore } from "./store/model-builder-store";
export { AppStore } from "./store/app-store";
export type { ConnectionMode } from "./store/app-store";

// ─── Projections ──────────────────────────────────────────────
export { projectTableColumns } from "./projection/project-table-columns";
export { projectFilterSchema } from "./projection/project-filter-schema";
export { projectMobileCard } from "./projection/project-mobile-card";
export type {
  TableColumnProjection,
  FilterSchemaProjection,
  MobileCardProjection,
} from "./projection/types";

// ─── Schema Utilities ─────────────────────────────────────────
export { normalizeSchema } from "./schema/normalize-schema";
export { buildModelSchema } from "./schema/build-model-schema";
export { schemaToBuilderDraft } from "./schema/schema-to-builder-draft";
