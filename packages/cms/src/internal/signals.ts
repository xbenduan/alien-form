import { signal } from '@alien-form/core';
import type {
  ModelSummary,
  ModelRecord,
  Pagination,
  Sorter,
  TableColumn,
  FilterField,
  DetailItem,
} from './types';

// ─── Connection ─────────────────────────────────────────────
export const connected = signal(false);

// ─── Schema ─────────────────────────────────────────────────
export const schemas = signal<Record<string, any>>({});
export const summaries = signal<ModelSummary[]>([]);
export const schemaLoading = signal(false);

// ─── Record ─────────────────────────────────────────────────
export const currentModel = signal('');
export const records = signal<ModelRecord[]>([]);
export const total = signal(0);
export const recordLoading = signal(false);
export const filters = signal<Record<string, unknown>>({});
export const pagination = signal<Pagination>({ current: 1, pageSize: 10 });
export const sorter = signal<Sorter | undefined>(undefined);

// ─── Projection (derived from schema, auto-computed) ────────
export const tableColumns = signal<TableColumn[]>([]);
export const filterFields = signal<FilterField[]>([]);
export const detailItems = signal<DetailItem[]>([]);
export const addFormSchema = signal<any>(undefined);
export const editFormSchema = signal<any>(undefined);

// ─── Action State Machine ───────────────────────────────────
export const actionMode = signal<'closed' | 'add' | 'edit' | 'detail'>('closed');
export const activeRecordId = signal<string | undefined>(undefined);
export const activeRecord = signal<ModelRecord | undefined>(undefined);
export const detailLoading = signal(false);
export const submitting = signal(false);
