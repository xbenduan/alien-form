import { signal } from '@alien-form/core';
import { useEffect, useMemo } from 'react';
import { useSignalValue } from '@alien-form/react';
import type {
  CmsModelSchema,
  ModelActionKind,
  ModelActionMode,
  ModelActionOpenMode,
  ModelPageStore,
  ModelRecord,
  Pagination,
  Sorter,
} from '@alien-form/cms';
import { cmsAppStore } from '../data/cms-data-access';
import { useModelSchema } from './use-model-schema';
import type { ModelRouteState } from '../types/model';

interface UseModelPageOptions {
  routeAction: ModelRouteState;
  onRouteActionChange: (nextAction: ModelRouteState) => void;
}

interface UseModelPageResult {
  modelName: string;
  schema?: CmsModelSchema;
  schemaLoading: boolean;
  schemaError?: Error | null;
  filterFields: ModelPageStore['filterFields'];
  tableColumns: ModelPageStore['tableColumns'];
  addSchema?: CmsModelSchema;
  editSchema?: CmsModelSchema;
  detailSchema?: CmsModelSchema;
  records: ModelRecord[];
  total: number;
  listLoading: boolean;
  filters: Record<string, unknown>;
  pagination: { current: number; pageSize: number };
  sorter?: { field?: string; order?: 'ascend' | 'descend' };
  actionMode: ModelActionMode;
  actionOpenMode?: ModelActionOpenMode;
  activeRecordId?: string;
  activeRecord?: ModelRecord;
  detailLoading: boolean;
  setFilters: (values: Record<string, unknown>) => void;
  setPagination: (values: { current: number; pageSize: number }) => void;
  setSorter: (values?: { field?: string; order?: 'ascend' | 'descend' }) => void;
  openAdd: () => void;
  openEdit: (id: string) => void;
  openDetail: (id: string) => void;
  closeAction: () => void;
  submitAdd: (values: Record<string, unknown>) => Promise<void>;
  submitEdit: (values: Record<string, unknown>) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
  submitting: boolean;
  deleting: boolean;
}

const emptyFiltersSignal = signal<Record<string, unknown>>({});
const defaultPaginationSignal = signal<Pagination>({ current: 1, pageSize: 10 });
const emptyRecordsSignal = signal<ModelRecord[]>([]);
const zeroSignal = signal(0);
const falseSignal = signal(false);
const undefinedSorterSignal = signal<Sorter | undefined>(undefined);
const closedActionModeSignal = signal<ModelActionMode>('closed');
const undefinedActionOpenModeSignal = signal<ModelActionOpenMode | undefined>(undefined);
const undefinedRecordIdSignal = signal<string | undefined>(undefined);
const undefinedRecordSignal = signal<ModelRecord | undefined>(undefined);

export function useModelPage(modelName: string, options: UseModelPageOptions): UseModelPageResult {
  const { routeAction, onRouteActionChange } = options;
  const schemaQuery = useModelSchema(modelName);
  const schema = schemaQuery.data;
  const store = useMemo(
    () => (schema ? cmsAppStore.createModelPageStore(modelName, schema as CmsModelSchema) : undefined),
    [modelName, schema],
  );
  const filters = useSignalValue<Record<string, unknown>>(store?.filters ?? emptyFiltersSignal);
  const pagination = useSignalValue<Pagination>(store?.pagination ?? defaultPaginationSignal);
  const sorter = useSignalValue<Sorter | undefined>(store?.sorter ?? undefinedSorterSignal);
  const records = useSignalValue<ModelRecord[]>(store?.records ?? emptyRecordsSignal);
  const total = useSignalValue<number>(store?.total ?? zeroSignal);
  const listLoading = useSignalValue<boolean>(store?.listLoading ?? falseSignal);
  const actionMode = useSignalValue<ModelActionMode>(store?.actionMode ?? closedActionModeSignal);
  const actionOpenMode = useSignalValue<ModelActionOpenMode | undefined>(store?.actionOpenMode ?? undefinedActionOpenModeSignal);
  const activeRecordId = useSignalValue<string | undefined>(store?.activeRecordId ?? undefinedRecordIdSignal);
  const activeRecord = useSignalValue<ModelRecord | undefined>(store?.activeRecord ?? undefinedRecordSignal);
  const detailLoading = useSignalValue<boolean>(store?.detailLoading ?? falseSignal);
  const submitting = useSignalValue<boolean>(store?.submitting ?? falseSignal);

  useEffect(() => {
    if (!store) return;
    void store.fetchList();
  }, [store]);

  useEffect(() => {
    return () => {
      store?.dispose();
    };
  }, [store]);

  useEffect(() => {
    if (!store) return;

    if (routeAction.mode === 'closed') {
      if (store.actionMode() !== 'closed' && store.actionOpenMode() === 'page') {
        store.closeAction();
      }
      return;
    }

    const routeOpenMode = store.schema['x-model']?.openMode?.[routeAction.mode] ?? 'drawer';
    if (routeOpenMode !== 'page') {
      onRouteActionChange({ mode: 'closed' });
      return;
    }

    if (routeAction.mode === 'add') {
      if (store.actionMode() !== 'add') {
        store.openAdd();
      }
      return;
    }

    if (!routeAction.recordId) {
      return;
    }

    if (store.actionMode() === routeAction.mode && store.activeRecordId() === routeAction.recordId) {
      return;
    }

    if (routeAction.mode === 'edit') {
      store.openEdit(routeAction.recordId);
      return;
    }

    store.openDetail(routeAction.recordId);
  }, [onRouteActionChange, routeAction, store]);

  const openAction = (mode: ModelActionKind, recordId?: string) => {
    if (!store) return;

    const openMode = store.schema['x-model']?.openMode?.[mode] ?? 'drawer';
    if (openMode === 'page') {
      onRouteActionChange(
        mode === 'add'
          ? { mode }
          : {
              mode,
              recordId,
            },
      );
      return;
    }

    if (mode === 'add') {
      store.openAdd();
      return;
    }

    if (!recordId) {
      return;
    }

    if (mode === 'edit') {
      store.openEdit(recordId);
      return;
    }

    store.openDetail(recordId);
  };

  const closeAction = () => {
    if (!store) return;

    if (store.actionOpenMode() === 'page') {
      onRouteActionChange({ mode: 'closed' });
      return;
    }

    store.closeAction();
  };

  return {
    modelName,
    schema,
    schemaLoading: schemaQuery.isLoading || schemaQuery.isFetching,
    schemaError: schemaQuery.error,
    filterFields: store?.filterFields ?? [],
    tableColumns: store?.tableColumns ?? [],
    addSchema: store?.addSchema,
    editSchema: store?.editSchema,
    detailSchema: store?.detailSchema,
    records: records ?? [],
    total: total ?? 0,
    listLoading: Boolean(listLoading),
    filters,
    pagination,
    sorter,
    actionMode,
    actionOpenMode,
    activeRecordId,
    activeRecord,
    detailLoading: Boolean(detailLoading),
    setFilters: (values) => {
      store?.setFilters(values);
    },
    setPagination: (values) => {
      store?.setPagination(values);
    },
    setSorter: (values) => {
      if (values?.field && values.order) {
        store?.setSorter({
          field: values.field,
          order: values.order,
        });
        return;
      }
      store?.setSorter(undefined);
    },
    openAdd: () => {
      openAction('add');
    },
    openEdit: (id) => {
      openAction('edit', id);
    },
    openDetail: (id) => {
      openAction('detail', id);
    },
    closeAction,
    submitAdd: async (values) => {
      await store?.submitAdd(values);
    },
    submitEdit: async (values) => {
      await store?.submitEdit(values);
    },
    removeRecord: async (id) => {
      await store?.removeRecord(id);
    },
    submitting: Boolean(submitting),
    deleting: false,
  };
}
