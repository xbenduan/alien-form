import { getRecordProvider } from '../internal/provider';

/**
 * List records with optional filters, pagination, and sorting.
 */
export function listRecords(params: {
  model: string;
  filters?: Record<string, unknown>;
  pagination?: { current: number; pageSize: number };
  sorter?: { field: string; order: 'ascend' | 'descend' };
}) {
  return getRecordProvider().list(params);
}

/**
 * Get a single record by id.
 */
export function getRecord(model: string, id: string) {
  return getRecordProvider().detail({ model, id });
}

/**
 * Create a new record.
 */
export function createRecord(model: string, values: Record<string, unknown>) {
  return getRecordProvider().create({ model, values });
}

/**
 * Update a record (merge mode).
 */
export function updateRecord(model: string, id: string, values: Record<string, unknown>) {
  return getRecordProvider().update({ model, id, values });
}

/**
 * Delete a record.
 */
export function deleteRecord(model: string, id: string) {
  return getRecordProvider().delete({ model, id });
}

/**
 * Batch delete records.
 */
export function batchDeleteRecords(model: string, ids: string[]) {
  const provider = getRecordProvider();
  if (provider.batchDelete) {
    return provider.batchDelete({ model, ids });
  }
  // Fallback: sequential
  return Promise.all(ids.map((id) => provider.delete({ model, id }))).then(() => ({
    success: true as const,
  }));
}
