import {
  batchDeleteRecords,
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  projectFilterFields,
  projectTableColumns,
  updateRecord,
} from "@alien-form/cms";
import type {
  CmsFieldSchema,
  CmsModelSchema,
  ModelActionKind,
  ModelActionOpenMode,
  ModelRecord,
} from "@alien-form/cms";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { RecordRouteState, FilterFieldProjection, ModelActionMode, TableColumnProjection } from "../domains/record/types/record";
import {
  clearTableVisibleKeys,
  getDefaultVisibleKeys,
  readTableVisibleKeys,
  sanitizeVisibleKeys,
  writeTableVisibleKeys,
} from "../domains/record/utils/table-column-preference";
import { schemaQueryKeys, useSchemaDetail } from "./use-schema-store";

export const recordQueryKeys = {
  all: ["records"] as const,
  list: (
    modelName: string,
    filters: Record<string, unknown>,
    pagination: { current: number; pageSize: number },
    sorter?: { field?: string; order?: "ascend" | "descend" },
  ) => ["records", modelName, "list", filters, pagination, sorter] as const,
  detail: (modelName: string, id?: string) => ["records", modelName, "detail", id] as const,
};

interface UseRecordStoreOptions {
  routeAction: RecordRouteState;
  onRouteActionChange: (nextAction: RecordRouteState) => void;
}

function buildFilterSchema(schema?: CmsModelSchema) {
  if (!schema?.properties) {
    return undefined;
  }

  const fields = (projectFilterFields(schema) as Array<Omit<FilterFieldProjection, "field">>).map((item) => ({
    ...item,
    field: schema.properties?.[item.key] as CmsFieldSchema,
  }));

  const properties = Object.fromEntries(
    fields.map((item) => [
      item.key,
      {
        ...item.field,
        decorator: "FilterItem",
      },
    ]),
  );

  const defaultVisibleKeys = resolveFilterDefaultVisibleKeys(schema, fields);

  return {
    schema: {
      type: "object",
      properties,
    } satisfies CmsModelSchema,
    defaultVisibleKeys,
  };
}

function resolveFilterDefaultVisibleKeys(
  schema: CmsModelSchema,
  fields: FilterFieldProjection[],
) {
  const explicitKeys = fields.filter((item) => item.defaultVisible).map((item) => item.key);
  if (explicitKeys.length > 0) {
    return explicitKeys;
  }

  const count = schema["x-model"]?.filter?.count ?? 3;
  return fields
    .slice()
    .sort((left, right) => left.order - right.order)
    .slice(0, count)
    .map((item) => item.key);
}

function buildTableColumns(schema?: CmsModelSchema, visibleKeys?: string[]) {
  if (!schema?.properties) {
    return [];
  }

  const visibleKeySet = new Set(
    sanitizeVisibleKeys(schema, visibleKeys ?? getDefaultVisibleKeys(schema)),
  );

  return (projectTableColumns(schema) as Array<Omit<TableColumnProjection, "field" | "type">>)
    .map((item) => {
      const field = schema.properties?.[item.key] as CmsFieldSchema | undefined;
      return {
        ...item,
        field: field ?? { type: "string", title: item.title },
        type: field?.type,
      } satisfies TableColumnProjection;
    })
    .filter((item) => visibleKeySet.has(item.key))
    .sort((left, right) => left.order - right.order);
}

function buildTableFieldOptions(schema?: CmsModelSchema) {
  return Object.entries(schema?.properties ?? {}).map(([key, field]) => ({
    value: key,
    label: `${field.title ?? key} (${key})`,
  }));
}

function createOptimisticRecord(modelName: string, values: Record<string, unknown>): ModelRecord {
  const now = new Date().toISOString();
  return {
    id: `tmp-${modelName}-${Date.now()}`,
    ...values,
    createdAt: now,
    updatedAt: now,
  };
}

export function useRecordStore(modelName: string, options: UseRecordStoreOptions) {
  const { routeAction, onRouteActionChange } = options;
  const queryClient = useQueryClient();
  const schemaQuery = useSchemaDetail(modelName);
  const schema = schemaQuery.data;
  const [filters, setFiltersState] = useState<Record<string, unknown>>({});
  const [pagination, setPaginationState] = useState({ current: 1, pageSize: 10 });
  const [sorter, setSorterState] = useState<{ field?: string; order?: "ascend" | "descend" }>();
  const [tableVisibleKeysState, setTableVisibleKeysState] = useState<string[] | undefined>(undefined);
  const [actionMode, setActionMode] = useState<ModelActionMode>("closed");
  const [actionOpenMode, setActionOpenMode] = useState<ModelActionOpenMode | undefined>(undefined);
  const [activeRecordId, setActiveRecordId] = useState<string>();

  useEffect(() => {
    setTableVisibleKeysState(readTableVisibleKeys(modelName, schema));
  }, [modelName, schema]);

  const tableVisibleKeys = useMemo(
    () =>
      sanitizeVisibleKeys(schema, tableVisibleKeysState ?? getDefaultVisibleKeys(schema)),
    [schema, tableVisibleKeysState],
  );

  const filterMeta = useMemo(() => buildFilterSchema(schema), [schema]);
  const tableColumns = useMemo(
    () => buildTableColumns(schema, tableVisibleKeys),
    [schema, tableVisibleKeys],
  );

  const listQueryKey = recordQueryKeys.list(modelName, filters, pagination, sorter);
  const listQuery = useQuery({
    queryKey: listQueryKey,
    enabled: Boolean(schema),
    queryFn: () =>
      listRecords({
        model: modelName,
        filters,
        pagination,
        sorter: sorter?.field && sorter.order ? { field: sorter.field, order: sorter.order } : undefined,
      }),
  });

  const detailQuery = useQuery<ModelRecord>({
    queryKey: recordQueryKeys.detail(modelName, activeRecordId),
    enabled: Boolean(schema && activeRecordId && actionMode !== "add"),
    queryFn: () => getRecord(modelName, activeRecordId!),
  });

  const setListCache = (
    updater: (current: { list: ModelRecord[]; total: number } | undefined) => { list: ModelRecord[]; total: number } | undefined,
  ) => {
    queryClient.setQueryData(listQueryKey, updater);
  };

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => createRecord(modelName, values),
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      const previous = queryClient.getQueryData<{ list: ModelRecord[]; total: number }>(listQueryKey);
      const optimisticRecord = createOptimisticRecord(modelName, values);

      setListCache((current) => {
        if (!current) return current;
        const nextList =
          pagination.current === 1
            ? [optimisticRecord, ...current.list].slice(0, pagination.pageSize)
            : current.list;
        return {
          list: nextList,
          total: current.total + 1,
        };
      });

      return { previous };
    },
    onError: (_error, _values, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listQueryKey, context.previous);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: recordQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: schemaQueryKeys.all }),
      ]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      updateRecord(modelName, id, values),
    onMutate: async ({ id, values }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listQueryKey }),
        queryClient.cancelQueries({ queryKey: recordQueryKeys.detail(modelName, id) }),
      ]);

      const previousList = queryClient.getQueryData<{ list: ModelRecord[]; total: number }>(listQueryKey);
      const previousDetail = queryClient.getQueryData<ModelRecord>(recordQueryKeys.detail(modelName, id));

      setListCache((current) =>
        current
          ? {
              ...current,
              list: current.list.map((item) =>
                item.id === id ? { ...item, ...values, updatedAt: new Date().toISOString() } : item,
              ),
            }
          : current,
      );
      queryClient.setQueryData(recordQueryKeys.detail(modelName, id), (current?: ModelRecord) =>
        current ? { ...current, ...values, updatedAt: new Date().toISOString() } : current,
      );

      return { previousList, previousDetail };
    },
    onError: (_error, variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(listQueryKey, context.previousList);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(recordQueryKeys.detail(modelName, variables.id), context.previousDetail);
      }
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: recordQueryKeys.detail(modelName, variables.id) }),
        queryClient.invalidateQueries({ queryKey: recordQueryKeys.all }),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecord(modelName, id),
    onMutate: async (id) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listQueryKey }),
        queryClient.cancelQueries({ queryKey: recordQueryKeys.detail(modelName, id) }),
      ]);

      const previousList = queryClient.getQueryData<{ list: ModelRecord[]; total: number }>(listQueryKey);
      const previousDetail = queryClient.getQueryData<ModelRecord>(recordQueryKeys.detail(modelName, id));

      setListCache((current) =>
        current
          ? {
              total: Math.max(0, current.total - 1),
              list: current.list.filter((item) => item.id !== id),
            }
          : current,
      );
      queryClient.removeQueries({ queryKey: recordQueryKeys.detail(modelName, id) });

      return { previousList, previousDetail, id };
    },
    onError: (_error, id, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(listQueryKey, context.previousList);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(recordQueryKeys.detail(modelName, id), context.previousDetail);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: recordQueryKeys.all });
    },
  });

  useEffect(() => {
    if (!schema) return;

    if (routeAction.mode === "closed") {
      if (actionOpenMode === "page") {
        setActionMode("closed");
        setActionOpenMode(undefined);
        setActiveRecordId(undefined);
      }
      return;
    }

    const nextOpenMode = schema["x-model"]?.openMode?.[routeAction.mode] ?? "drawer";
    if (nextOpenMode !== "page") {
      onRouteActionChange({ mode: "closed" });
      return;
    }

    setActionMode(routeAction.mode);
    setActionOpenMode(nextOpenMode);
    setActiveRecordId(routeAction.recordId);
  }, [actionOpenMode, onRouteActionChange, routeAction, schema]);

  const openAction = (mode: ModelActionKind, recordId?: string) => {
    const nextOpenMode = schema?.["x-model"]?.openMode?.[mode] ?? "drawer";
    if (nextOpenMode === "page") {
      onRouteActionChange(mode === "add" ? { mode } : { mode, recordId });
      return;
    }

    setActionMode(mode);
    setActionOpenMode(nextOpenMode);
    setActiveRecordId(recordId);
  };

  const closeAction = () => {
    if (actionOpenMode === "page") {
      onRouteActionChange({ mode: "closed" });
      return;
    }
    setActionMode("closed");
    setActionOpenMode(undefined);
    setActiveRecordId(undefined);
  };

  return {
    modelName,
    schema,
    schemaLoading: schemaQuery.isLoading || schemaQuery.isFetching,
    schemaError: schemaQuery.error,
    filterSchema: filterMeta?.schema,
    filterDefaultVisibleKeys: filterMeta?.defaultVisibleKeys ?? [],
    tableColumns,
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
    setFilters: (values: Record<string, unknown>) => {
      setFiltersState(values);
      setPaginationState((current) => ({ ...current, current: 1 }));
    },
    setPagination: setPaginationState,
    setSorter: setSorterState,
    tableVisibleKeys,
    tableFieldOptions: buildTableFieldOptions(schema),
    setTableVisibleKeys: (values: string[]) => {
      const nextVisibleKeys = sanitizeVisibleKeys(schema, values);
      setTableVisibleKeysState(nextVisibleKeys);
      if (schema) {
        writeTableVisibleKeys(modelName, schema, nextVisibleKeys);
      }
    },
    resetTableVisibleKeys: () => {
      clearTableVisibleKeys(modelName);
      setTableVisibleKeysState(undefined);
    },
    openAdd: () => openAction("add"),
    openEdit: (id: string) => openAction("edit", id),
    openDetail: (id: string) => openAction("detail", id),
    closeAction,
    submitAdd: async (values: Record<string, unknown>) => {
      await createMutation.mutateAsync(values);
      if (actionOpenMode === "page") {
        onRouteActionChange({ mode: "closed" });
      } else {
        closeAction();
      }
    },
    submitEdit: async (values: Record<string, unknown>) => {
      if (!activeRecordId) return;
      await updateMutation.mutateAsync({ id: activeRecordId, values });
      if (actionOpenMode === "page") {
        onRouteActionChange({ mode: "closed" });
      } else {
        closeAction();
      }
    },
    removeRecord: async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
    submitting: createMutation.isPending || updateMutation.isPending,
    deleting: deleteMutation.isPending,
    batchDelete: async (ids: string[]) => batchDeleteRecords(modelName, ids),
  };
}

