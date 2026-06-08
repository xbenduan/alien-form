/**
 * @alien-form/cms
 *
 * Minimal CMS core: pure async functions + projection utilities.
 * No internal state management — let the UI layer (useQuery) handle caching.
 * Provider is resolved from browser cache (localStorage key).
 */

// ─── Types ───────────────────────────────────────────────────
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
  SchemaListFilters,
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
  ModelBuilderReactionMode,
  BuilderFieldType,
  BuilderComponentName,
  BuilderReactionTarget,
} from "./types/builder";

// ─── Provider Management ────────────────────────────────────
export {
  registerProvider,
  initProvider,
  switchProvider,
  resetProvider,
  getCurrentProviderType,
} from './internal/provider';
export { createProviders } from "./provider/create-providers";
export type { SchemaProvider } from "./provider/schema-provider";
export type { RecordProvider } from "./provider/record-provider";
export type { LogProvider, LogEntry, LogListParams } from "./provider/log-provider";
export { LocalSchemaProvider, LocalRecordProvider, LocalLogProvider } from "./provider/local";

// ─── Schema API (async functions) ───────────────────────────
export {
  listSchemas,
  getSchema,
  createSchema,
  updateSchema,
  deleteSchema,
} from './api/schema';

// ─── Record API (async functions) ───────────────────────────
export {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  batchDeleteRecords,
} from './api/record';

// ─── Projection (pure functions) ────────────────────────────
export { projectTableColumns } from './projection/table-columns';
export { projectFilterFields } from './projection/filter-fields';
export { projectDetailItems } from './projection/detail-items';
export { projectFormSchema } from './projection/form-schema';

// ─── Schema Utilities ───────────────────────────────────────
export { normalizeSchema } from './schema/normalize-schema';
export { buildModelSchema } from './schema/build-model-schema';
export { schemaToBuilderDraft } from './schema/schema-to-builder-draft';
export {
  defineHandler,
  defineHandlers,
  createHandlerRegistry,
  createHandlerCatalog,
} from "./define/handlers";
export {
  defineAdapter,
  defineAdapters,
  createAdapterRegistry,
  createAdapterCatalog,
} from "./define/adapters";
