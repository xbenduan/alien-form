/**
 * @alien-form/cms
 *
 * Functional CMS core powered by alien-signals.
 * No types exported — consumers rely on TS inference.
 * All state is managed internally; consumers only call functions and read signals.
 */

// ─── Init / Connection ──────────────────────────────────────
export { connect, disconnect } from './store/connection';

// ─── Schema Operations ──────────────────────────────────────
export {
  loadSchemas,
  loadSchema,
  getSchema,
  createSchema,
  updateSchema,
  deleteSchema,
} from './store/schema';

// ─── Record Operations ──────────────────────────────────────
export {
  loadRecords,
  setFilters,
  setPagination,
  setSorter,
  refresh,
  createRecord,
  updateRecord,
  removeRecord,
  batchRemove,
  openAdd,
  openEdit,
  openDetail,
  closeAction,
} from './store/record';

// ─── Signals (read-only subscribe points for UI) ────────────
export {
  connected,
  summaries,
  schemaLoading,
  tableColumns,
  filterFields,
  detailItems,
  addFormSchema,
  editFormSchema,
  records,
  total,
  recordLoading,
  filters,
  pagination,
  sorter,
  actionMode,
  activeRecordId,
  activeRecord,
  detailLoading,
  submitting,
} from './internal/signals';

// ─── Schema Utilities (pure functions) ──────────────────────
export { normalizeSchema } from './schema/normalize-schema';
export { buildModelSchema } from './schema/build-model-schema';
export { schemaToBuilderDraft } from './schema/schema-to-builder-draft';
