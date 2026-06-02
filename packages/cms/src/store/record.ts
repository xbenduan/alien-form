import {
  currentModel,
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
} from '../internal/signals';
import { getRecordProvider } from '../internal/provider';

// ─── List Operations ──────────────────────────────────────────

/**
 * Load records for the given model (or current model if omitted).
 */
export async function loadRecords(modelName?: string) {
  const provider = getRecordProvider();
  const model = modelName ?? currentModel.get();
  if (modelName) currentModel.set(modelName);

  recordLoading.set(true);
  try {
    const result = await provider.list({
      model,
      filters: filters.get(),
      pagination: pagination.get(),
      sorter: sorter.get(),
    });
    records.set(result.list);
    total.set(result.total);
  } finally {
    recordLoading.set(false);
  }
}

/**
 * Set filter values and reload.
 */
export function setFilters(value: Record<string, unknown>) {
  filters.set(value);
  pagination.set({ ...pagination.get(), current: 1 });
  loadRecords();
}

/**
 * Set pagination and reload.
 */
export function setPagination(value: { current: number; pageSize: number }) {
  pagination.set(value);
  loadRecords();
}

/**
 * Set sorter and reload.
 */
export function setSorter(value?: { field: string; order: 'ascend' | 'descend' }) {
  sorter.set(value);
  loadRecords();
}

/**
 * Refresh current list.
 */
export async function refresh() {
  await loadRecords();
}

// ─── CRUD Operations ──────────────────────────────────────────

/**
 * Create a record and refresh list.
 */
export async function createRecord(values: Record<string, unknown>) {
  const provider = getRecordProvider();
  submitting.set(true);
  try {
    const result = await provider.create(currentModel.get(), values);
    if (result.success) {
      closeAction();
      await loadRecords();
    }
    return result;
  } finally {
    submitting.set(false);
  }
}

/**
 * Update a record and refresh list.
 */
export async function updateRecord(id: string, values: Record<string, unknown>) {
  const provider = getRecordProvider();
  submitting.set(true);
  try {
    const result = await provider.update(currentModel.get(), id, values);
    if (result.success) {
      closeAction();
      await loadRecords();
    }
    return result;
  } finally {
    submitting.set(false);
  }
}

/**
 * Remove a record and refresh list.
 */
export async function removeRecord(id: string) {
  const provider = getRecordProvider();
  const result = await provider.delete(currentModel.get(), id);
  if (result.success) await loadRecords();
  return result;
}

/**
 * Batch remove records.
 */
export async function batchRemove(ids: string[]) {
  const provider = getRecordProvider();
  if (provider.batchDelete) {
    const result = await provider.batchDelete(currentModel.get(), ids);
    if (result.success) await loadRecords();
    return result;
  }
  // Fallback: sequential delete
  for (const id of ids) {
    await provider.delete(currentModel.get(), id);
  }
  await loadRecords();
  return { success: true };
}

// ─── Action State Machine ─────────────────────────────────────

/**
 * Open add form.
 */
export function openAdd() {
  actionMode.set('add');
  activeRecordId.set(undefined);
  activeRecord.set(undefined);
}

/**
 * Open edit form for a record.
 */
export async function openEdit(id: string) {
  actionMode.set('edit');
  activeRecordId.set(id);
  await fetchDetail(id);
}

/**
 * Open detail view for a record.
 */
export async function openDetail(id: string) {
  actionMode.set('detail');
  activeRecordId.set(id);
  await fetchDetail(id);
}

/**
 * Close current action (add/edit/detail).
 */
export function closeAction() {
  actionMode.set('closed');
  activeRecordId.set(undefined);
  activeRecord.set(undefined);
}

// ─── Internal ─────────────────────────────────────────────────

async function fetchDetail(id: string) {
  const provider = getRecordProvider();
  detailLoading.set(true);
  try {
    const record = await provider.detail(currentModel.get(), id);
    activeRecord.set(record);
  } finally {
    detailLoading.set(false);
  }
}
