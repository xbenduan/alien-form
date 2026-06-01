import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadSchema } from '../core/schema/load-schema';
import { projectDetailItems } from '../core/projection/project-detail-items';
import { projectFilterFields } from '../core/projection/project-filter-fields';
import { projectFormSchema } from '../core/projection/project-form-schema';
import { projectTableColumns } from '../core/projection/project-table-columns';
import { localDataProvider } from '../data/provider/local-data-provider';
import type { DrawerMode } from '../types/model';

interface UseModelPageResult {
  modelName: string;
  schema: ReturnType<typeof loadSchema>;
  filterFields: ReturnType<typeof projectFilterFields>;
  tableColumns: ReturnType<typeof projectTableColumns>;
  addSchema: ReturnType<typeof projectFormSchema>;
  editSchema: ReturnType<typeof projectFormSchema>;
  detailItems: ReturnType<typeof projectDetailItems>;
  records: Awaited<ReturnType<typeof localDataProvider.list>>['list'];
  total: number;
  listLoading: boolean;
  filters: Record<string, unknown>;
  pagination: { current: number; pageSize: number };
  sorter?: { field?: string; order?: 'ascend' | 'descend' };
  drawerMode: DrawerMode;
  activeRecordId?: string;
  activeRecord?: Awaited<ReturnType<typeof localDataProvider.detail>>;
  detailLoading: boolean;
  setFilters: (values: Record<string, unknown>) => void;
  setPagination: (values: { current: number; pageSize: number }) => void;
  setSorter: (values?: { field?: string; order?: 'ascend' | 'descend' }) => void;
  openAdd: () => void;
  openEdit: (id: string) => void;
  openDetail: (id: string) => void;
  closeDrawer: () => void;
  submitAdd: (values: Record<string, unknown>) => Promise<void>;
  submitEdit: (values: Record<string, unknown>) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
  submitting: boolean;
  deleting: boolean;
}

export function useModelPage(modelName: string): UseModelPageResult {
  const queryClient = useQueryClient();
  const schema = useMemo(() => loadSchema(modelName), [modelName]);
  const filterFields = useMemo(() => projectFilterFields(schema), [schema]);
  const tableColumns = useMemo(() => projectTableColumns(schema), [schema]);
  const addSchema = useMemo(() => projectFormSchema(schema, 'add'), [schema]);
  const editSchema = useMemo(() => projectFormSchema(schema, 'edit'), [schema]);
  const detailItems = useMemo(() => projectDetailItems(schema), [schema]);

  const [filters, setFilterState] = useState<Record<string, unknown>>({});
  const [pagination, setPaginationState] = useState({
    current: 1,
    pageSize: schema['x-model']?.defaultPageSize ?? 10,
  });
  const [sorter, setSorterState] = useState<{ field?: string; order?: 'ascend' | 'descend' }>();
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('closed');
  const [activeRecordId, setActiveRecordId] = useState<string>();

  const listQuery = useQuery({
    queryKey: ['model-list', modelName, filters, pagination, sorter],
    queryFn: () =>
      localDataProvider.list({
        model: modelName,
        filters,
        pagination,
        sorter,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ['model-detail', modelName, activeRecordId],
    enabled: Boolean(activeRecordId) && drawerMode !== 'add',
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
      setDrawerMode('closed');
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
      setDrawerMode('closed');
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
    detailItems,
    records: listQuery.data?.list ?? [],
    total: listQuery.data?.total ?? 0,
    listLoading: listQuery.isLoading || listQuery.isFetching,
    filters,
    pagination,
    sorter,
    drawerMode,
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
      setActiveRecordId(undefined);
      setDrawerMode('add');
    },
    openEdit: (id) => {
      setActiveRecordId(id);
      setDrawerMode('edit');
    },
    openDetail: (id) => {
      setActiveRecordId(id);
      setDrawerMode('detail');
    },
    closeDrawer: () => {
      setDrawerMode('closed');
      setActiveRecordId(undefined);
    },
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
