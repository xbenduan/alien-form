import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadSchema } from '../core/schema/load-schema';
import { projectDetailSchema } from '../core/projection/project-detail-schema';
import { projectFilterFields } from '../core/projection/project-filter-fields';
import { projectFormSchema } from '../core/projection/project-form-schema';
import { projectTableColumns } from '../core/projection/project-table-columns';
import { localDataProvider } from '../data/provider/local-data-provider';
import type { ModelActionKind, ModelActionMode, ModelActionOpenMode, ModelRouteState } from '../types/model';

interface UseModelPageOptions {
  routeAction: ModelRouteState;
  onRouteActionChange: (nextAction: ModelRouteState) => void;
}

interface UseModelPageResult {
  modelName: string;
  schema: ReturnType<typeof loadSchema>;
  filterFields: ReturnType<typeof projectFilterFields>;
  tableColumns: ReturnType<typeof projectTableColumns>;
  addSchema: ReturnType<typeof projectFormSchema>;
  editSchema: ReturnType<typeof projectFormSchema>;
  detailSchema: ReturnType<typeof projectDetailSchema>;
  records: Awaited<ReturnType<typeof localDataProvider.list>>['list'];
  total: number;
  listLoading: boolean;
  filters: Record<string, unknown>;
  pagination: { current: number; pageSize: number };
  sorter?: { field?: string; order?: 'ascend' | 'descend' };
  actionMode: ModelActionMode;
  actionOpenMode?: ModelActionOpenMode;
  activeRecordId?: string;
  activeRecord?: Awaited<ReturnType<typeof localDataProvider.detail>>;
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

export function useModelPage(modelName: string, options: UseModelPageOptions): UseModelPageResult {
  const { routeAction, onRouteActionChange } = options;
  const queryClient = useQueryClient();
  const schema = useMemo(() => loadSchema(modelName), [modelName]);
  const filterFields = useMemo(() => projectFilterFields(schema), [schema]);
  const tableColumns = useMemo(() => projectTableColumns(schema), [schema]);
  const addSchema = useMemo(() => projectFormSchema(schema, 'add'), [schema]);
  const editSchema = useMemo(() => projectFormSchema(schema, 'edit'), [schema]);
  const detailSchema = useMemo(() => projectDetailSchema(schema), [schema]);

  const [filters, setFilterState] = useState<Record<string, unknown>>({});
  const [pagination, setPaginationState] = useState({
    current: 1,
    pageSize: schema['x-model']?.defaultPageSize ?? 10,
  });
  const [sorter, setSorterState] = useState<{ field?: string; order?: 'ascend' | 'descend' }>();
  const [overlayAction, setOverlayAction] = useState<ModelRouteState>({ mode: 'closed' });

  const actionOpenModeMap = useMemo(
    () => ({
      add: schema['x-model']?.openMode?.add ?? 'drawer',
      edit: schema['x-model']?.openMode?.edit ?? 'drawer',
      detail: schema['x-model']?.openMode?.detail ?? 'drawer',
    }),
    [schema],
  );

  const pageAction = useMemo(() => {
    if (routeAction.mode === 'closed') {
      return { mode: 'closed' } satisfies ModelRouteState;
    }

    return actionOpenModeMap[routeAction.mode] === 'page'
      ? routeAction
      : ({ mode: 'closed' } satisfies ModelRouteState);
  }, [actionOpenModeMap, routeAction]);

  const currentAction = pageAction.mode !== 'closed' ? pageAction : overlayAction;
  const activeRecordId = currentAction.recordId;
  const actionMode = currentAction.mode;
  const actionOpenMode = actionMode === 'closed' ? undefined : actionOpenModeMap[actionMode];

  useEffect(() => {
    if (routeAction.mode !== 'closed' && actionOpenModeMap[routeAction.mode] !== 'page') {
      onRouteActionChange({ mode: 'closed' });
    }
  }, [actionOpenModeMap, onRouteActionChange, routeAction]);

  const closeAction = () => {
    setOverlayAction({ mode: 'closed' });

    if (pageAction.mode !== 'closed') {
      onRouteActionChange({ mode: 'closed' });
    }
  };

  const openAction = (mode: ModelActionKind, recordId?: string) => {
    const nextAction =
      mode === 'add'
        ? ({ mode } satisfies ModelRouteState)
        : ({
            mode,
            recordId,
          } satisfies ModelRouteState);

    if (actionOpenModeMap[mode] === 'page') {
      onRouteActionChange(nextAction);
      setOverlayAction({ mode: 'closed' });
      return;
    }

    setOverlayAction(nextAction);
  };

  const listQuery = useQuery({
    queryKey: ['model-list', modelName, filters, pagination, sorter],
    queryFn: () =>
      localDataProvider.list({
        model: modelName,
        filters,
        pagination,
        sorter,
      }),
    placeholderData: (previousData) => previousData,
  });

  const detailQuery = useQuery({
    queryKey: ['model-detail', modelName, activeRecordId],
    enabled: Boolean(activeRecordId) && actionMode !== 'add',
    queryFn: () => localDataProvider.detail({ model: modelName, id: activeRecordId! }),
  });

  const invalidateList = async () => {
    await queryClient.invalidateQueries({ queryKey: ['model-list', modelName] });
  };

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      localDataProvider.create({ model: modelName, values }),
    onSuccess: async () => {
      await invalidateList();
      closeAction();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      localDataProvider.update({ model: modelName, id: activeRecordId!, values }),
    onSuccess: async () => {
      await Promise.all([
        invalidateList(),
        queryClient.invalidateQueries({ queryKey: ['model-detail', modelName, activeRecordId] }),
      ]);
      closeAction();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => localDataProvider.remove({ model: modelName, id }),
    onSuccess: async () => {
      await invalidateList();
    },
  });

  return {
    modelName,
    schema,
    filterFields,
    tableColumns,
    addSchema,
    editSchema,
    detailSchema,
    records: listQuery.data?.list ?? [],
    total: listQuery.data?.total ?? 0,
    listLoading: listQuery.isLoading || listQuery.isFetching,
    filters,
    pagination,
    sorter,
    actionMode,
    actionOpenMode,
    activeRecordId,
    activeRecord: detailQuery.data,
    detailLoading: detailQuery.isLoading || detailQuery.isFetching,
    setFilters: (values) => {
      setFilterState(values);
      setPaginationState((current) => ({ ...current, current: 1 }));
    },
    setPagination: setPaginationState,
    setSorter: setSorterState,
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
      await createMutation.mutateAsync(values);
    },
    submitEdit: async (values) => {
      await updateMutation.mutateAsync(values);
    },
    removeRecord: async (id) => {
      await removeMutation.mutateAsync(id);
    },
    submitting: createMutation.isPending || updateMutation.isPending,
    deleting: removeMutation.isPending,
  };
}
