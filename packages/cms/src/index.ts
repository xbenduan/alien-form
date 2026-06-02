/**
 * @alien-form/cms
 *
 * Minimal CMS core: pure async functions + projection utilities.
 * No internal state management — let the UI layer (useQuery) handle caching.
 * Provider is resolved from browser cache (localStorage key).
 */

// ─── Provider Management ────────────────────────────────────
export {
  registerProvider,
  initProvider,
  switchProvider,
  resetProvider,
  getCurrentProviderType,
} from './internal/provider';

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
