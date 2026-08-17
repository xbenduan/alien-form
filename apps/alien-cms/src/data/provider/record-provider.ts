import type {
  RecordBatchDeleteParams,
  RecordBatchDeleteResult,
  RecordCreateParams,
  RecordCreateResult,
  RecordDeleteParams,
  RecordDeleteResult,
  RecordDetailParams,
  RecordDetailResult,
  RecordListParams,
  RecordListResult,
  RecordUpdateParams,
  RecordUpdateResult,
} from "../types/record";

/**
 * Interface for model record CRUD operations.
 * Implementations: LocalRecordProvider (IndexedDB), RemoteRecordProvider (HTTP).
 */
export interface RecordProvider {
  /** List records with filtering, pagination, and sorting. */
  list(params: RecordListParams): Promise<RecordListResult>;

  /** Get a single record by id. */
  detail(params: RecordDetailParams): Promise<RecordDetailResult>;

  /** Create a new record. */
  create(params: RecordCreateParams): Promise<RecordCreateResult>;

  /** Update an existing record. */
  update(params: RecordUpdateParams): Promise<RecordUpdateResult>;

  /** Delete a single record. */
  delete(params: RecordDeleteParams): Promise<RecordDeleteResult>;

  /** Batch delete records. Optional — not all backends support this. */
  batchDelete?(params: RecordBatchDeleteParams): Promise<RecordBatchDeleteResult>;
}
