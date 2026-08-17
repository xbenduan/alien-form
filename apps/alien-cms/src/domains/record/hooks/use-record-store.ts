import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  batchDeleteRecords,
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  updateRecord,
} from "../../../data";
import type { ModelRecord } from "../../../data";
import { countAtomicFields } from "../../model";
import type {
  CmsModelSchema,
  ModelActionKind,
  ModelActionOpenMode,
} from "../../model";
import { useSchemaDetail } from "../../model/hooks/use-schema-store";
import {
  buildDynamicDataSourceMap,
  buildTableFieldOptions,
  collectDynamicDataSourceRequests,
  projectDetailSchema,
  projectFilter,
  projectFormSchema,
  projectTableColumns,
  toSafeFieldKey,
} from "../projection";
import type { ModelActionMode, RecordRouteState } from "../types/record";
import {
  flattenFilterValues,
  restoreFilterValues,
} from "../utils/filter-values";
import {
  clearTableVisibleKeys,
  getDefaultVisibleKeys,
  readTableVisibleKeys,
  sanitizeVisibleKeys,
  writeTableVisibleKeys,
} from "../utils/table-column-preference";

export const recordQueryKeys = {
  all: ["records"] as const,
  model: (modelName: string) => ["records", modelName] as const,
  lists: (modelName: string) => ["records", modelName, "list"] as const,
  list: (
    modelName: string,
    filters: Record<string, unknown>,
    pagination: { current: number; pageSize: number },
    sorter?: { field?: string; order?: "ascend" | "descend" },
  ) => ["records", modelName, "list", filters, pagination, sorter] as const,
  detail: (modelName: string, id?: string) =>
    ["records", modelName, "detail", id] as const,
};

interface UseRecordStoreOptions {
  routeAction: RecordRouteState;
  onRouteActionChange: (nextAction: RecordRouteState) => void;
}

interface TableVisibleKeysState {
  modelName: string;
  schema: CmsModelSchema | undefined;
  values: string[] | undefined;
}

function resolveOpenMode(
  schema: CmsModelSchema | undefined,
  mode: ModelActionKind,
): ModelActionOpenMode {
  const explicit = schema?.["x-model"]?.openMode?.[mode];
  if (explicit) return explicit;
  const count = countAtomicFields(schema);
  if (count <= 6) return "modal";
  if (count <= 12) return "drawer";
  return "page";
}

export function useRecordStore(modelName: string, options: UseRecordStoreOptions) {
  const { routeAction, onRouteActionChange } = options;
  const queryClient = useQueryClient();
  const schemaQuery = useSchemaDetail(modelName);
  const schema = schemaQuery.data;
  const [filters, setFiltersState] = useState<Record<string, unknown>>({});
  const [pagination, setPaginationState] = useState({ current: 1, pageSize: 10 });
  const [sorter, setSorterState] =
    useState<{ field?: string; order?: "ascend" | "descend" }>();
  const [tableVisibleKeysState, setTableVisibleKeysState] =
    useState<TableVisibleKeysState>();
  const [actionMode, setActionMode] = useState<ModelActionMode>("closed");
  const [actionOpenMode, setActionOpenMode] =
    useState<ModelActionOpenMode | undefined>(undefined);
  const [activeRecordId, setActiveRecordId] = useState<string>();

  const dynamicDataSourceRequests = useMemo(
    () => collectDynamicDataSourceRequests(schema),
    [schema],
  );
  const dynamicDataSourceQueries = useQueries({
    queries: dynamicDataSourceRequests.map((request) => ({
      queryKey: [
        "records",
        request.model,
        "dataSource",
        request.valueKey,
        request.labelKey,
      ],
      enabled: Boolean(schema),
      queryFn: async () => {
        const data = await listRecords({
          model: request.model,
          pagination: { current: 1, pageSize: 1000 },
        });
        return data.list.map((item) => ({
          value: item[request.valueKey],
          label: String(item[request.labelKey] ?? item[request.valueKey] ?? ""),
        }));
      },
    })),
  });
  const dynamicDataSources = useMemo(
    () => buildDynamicDataSourceMap(dynamicDataSourceRequests, dynamicDataSourceQueries),
    [dynamicDataSourceQueries, dynamicDataSourceRequests],
  );

  const tableVisibleKeys = useMemo(() => {
    const storedVisibleKeys =
      tableVisibleKeysState?.modelName === modelName &&
      tableVisibleKeysState.schema === schema
        ? tableVisibleKeysState.values
        : readTableVisibleKeys(modelName, schema);

    return sanitizeVisibleKeys(
      schema,
      storedVisibleKeys ?? getDefaultVisibleKeys(schema),
    );
  }, [modelName, schema, tableVisibleKeysState]);
  const filterMeta = useMemo(
    () => projectFilter(schema, dynamicDataSources),
    [dynamicDataSources, schema],
  );
  const filterInitialValues = useMemo(() => {
    const flat = flattenFilterValues(filters);
    return Object.fromEntries(
      Object.entries(flat).map(([flatKey, value]) => [toSafeFieldKey(flatKey), value]),
    );
  }, [filters]);
  const tableColumns = useMemo(
    () => projectTableColumns(schema, tableVisibleKeys, dynamicDataSources),
    [dynamicDataSources, schema, tableVisibleKeys],
  );
  const projectedActionSchema = useMemo(() => {
    if (!schema) return undefined;

    const mode = actionMode === "closed" ? routeAction.mode : actionMode;
    if (mode === "detail") return projectDetailSchema(schema);
    if (mode === "add" || mode === "edit") return projectFormSchema(schema, mode);
    return undefined;
  }, [actionMode, routeAction.mode, schema]);

  const listQuery = useQuery({
    queryKey: recordQueryKeys.list(modelName, filters, pagination, sorter),
    enabled: Boolean(schema),
    queryFn: () =>
      listRecords({
        model: modelName,
        filters,
        pagination,
        sorter:
          sorter?.field && sorter.order
            ? { field: sorter.field, order: sorter.order }
            : undefined,
      }),
  });

  const detailQuery = useQuery<ModelRecord>({
    queryKey: recordQueryKeys.detail(modelName, activeRecordId),
    enabled: Boolean(schema && activeRecordId && actionMode !== "add"),
    queryFn: () => getRecord(modelName, activeRecordId!),
  });

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => createRecord(modelName, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: recordQueryKeys.lists(modelName) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      updateRecord(modelName, id, values),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: recordQueryKeys.detail(modelName, variables.id),
        }),
        queryClient.invalidateQueries({ queryKey: recordQueryKeys.lists(modelName) }),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecord(modelName, id),
    onSuccess: async (_data, id) => {
      queryClient.removeQueries({ queryKey: recordQueryKeys.detail(modelName, id) });
      await queryClient.invalidateQueries({ queryKey: recordQueryKeys.lists(modelName) });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => batchDeleteRecords(modelName, ids),
    onSuccess: async (_data, ids) => {
      for (const id of ids) {
        queryClient.removeQueries({ queryKey: recordQueryKeys.detail(modelName, id) });
      }
      await queryClient.invalidateQueries({ queryKey: recordQueryKeys.lists(modelName) });
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

    const nextOpenMode = resolveOpenMode(schema, routeAction.mode);
    if (nextOpenMode !== "page") {
      onRouteActionChange({ mode: "closed" });
      return;
    }

    setActionMode(routeAction.mode);
    setActionOpenMode(nextOpenMode);
    setActiveRecordId(routeAction.recordId);
  }, [actionOpenMode, onRouteActionChange, routeAction, schema]);

  const openAction = (mode: ModelActionKind, recordId?: string) => {
    const nextOpenMode = resolveOpenMode(schema, mode);
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
    actionSchema: projectedActionSchema,
    schemaLoading: schemaQuery.isLoading || schemaQuery.isFetching,
    schemaError: schemaQuery.error,
    filterSchema: filterMeta?.schema,
    filterDefaultVisibleKeys: filterMeta?.defaultVisibleKeys ?? [],
    filterInitialValues,
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
      const keyToPath = filterMeta?.keyToPath ?? {};
      const flat = Object.fromEntries(
        Object.entries(values).map(([safeKey, value]) => [
          keyToPath[safeKey] ?? safeKey,
          value,
        ]),
      );
      setFiltersState(restoreFilterValues(flat));
      setPaginationState((current) => ({ ...current, current: 1 }));
    },
    setPagination: setPaginationState,
    setSorter: setSorterState,
    tableVisibleKeys,
    tableFieldOptions: buildTableFieldOptions(schema),
    setTableVisibleKeys: (values: string[]) => {
      const nextVisibleKeys = sanitizeVisibleKeys(schema, values);
      setTableVisibleKeysState({ modelName, schema, values: nextVisibleKeys });
      if (schema) writeTableVisibleKeys(modelName, schema, nextVisibleKeys);
    },
    resetTableVisibleKeys: () => {
      clearTableVisibleKeys(modelName);
      setTableVisibleKeysState({ modelName, schema, values: undefined });
    },
    openAdd: () => openAction("add"),
    openEdit: (id: string) => openAction("edit", id),
    openDetail: (id: string) => openAction("detail", id),
    closeAction,
    refresh: async () => {
      await listQuery.refetch();
    },
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
    deleting: deleteMutation.isPending || batchDeleteMutation.isPending,
    batchDelete: async (ids: string[]) => {
      await batchDeleteMutation.mutateAsync(ids);
    },
  };
}
