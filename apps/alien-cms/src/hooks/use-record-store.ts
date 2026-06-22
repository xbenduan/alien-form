import {
  batchDeleteRecords,
  countAtomicFields,
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
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { RecordRouteState, FilterFieldProjection, ModelActionMode, TableColumnProjection } from "../domains/record/types/record";
import {
  clearTableVisibleKeys,
  getDefaultVisibleKeys,
  readTableVisibleKeys,
  sanitizeVisibleKeys,
  writeTableVisibleKeys,
} from "../domains/record/utils/table-column-preference";
import {
  flattenFilterValues,
  restoreFilterValues,
} from "../domains/record/utils/filter-values";
import { useSchemaDetail } from "./use-schema-store";
import { registry } from "../shared/adapters";

type DataSourceOption = NonNullable<CmsFieldSchema["dataSource"]>[number];

interface DynamicDataSourceRequest {
  path: string;
  model: string;
  valueKey: string;
  labelKey: string;
}

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
  detail: (modelName: string, id?: string) => ["records", modelName, "detail", id] as const,
};

interface UseRecordStoreOptions {
  routeAction: RecordRouteState;
  onRouteActionChange: (nextAction: RecordRouteState) => void;
}

/** 把扁平 filter key（`$root.a.b` 或顶层 `x`）转换为不含点的安全字段 key。*/
function toSafeKey(flatKey: string): string {
  return flatKey.replace(/\$root\./, "").replace(/\./g, "__");
}

/** 沿真实点路径从 schema.properties 读取叶子字段 schema。*/
function getLeafFieldByPath(schema: CmsModelSchema, path: string): CmsFieldSchema | undefined {
  const segments = path.split(".");
  let current: Record<string, CmsFieldSchema> | undefined = schema.properties;
  let field: CmsFieldSchema | undefined;

  for (const segment of segments) {
    if (!current) return undefined;
    field = current[segment];
    if (!field) return undefined;

    if (field.type === "array" && field.items && !Array.isArray(field.items) && field.items.properties) {
      current = field.items.properties as Record<string, CmsFieldSchema>;
    } else {
      current = field.properties as Record<string, CmsFieldSchema> | undefined;
    }
  }

  return field;
}

function readDynamicDataSourceRequest(
  path: string,
  field: CmsFieldSchema,
): DynamicDataSourceRequest | undefined {
  const config = field["x-cms"]?.reactions?.dataSource;
  const model = config?.model;
  if (typeof model !== "string" || !model) {
    return undefined;
  }
  const value = typeof config.value === "string" && config.value ? config.value : "id";
  const label =
    typeof config.label === "string" && config.label
      ? config.label
      : value;

  return {
    path,
    model,
    valueKey: value,
    labelKey: label,
  };
}

function collectDynamicDataSourceRequests(schema?: CmsModelSchema) {
  const requests: DynamicDataSourceRequest[] = [];

  const visit = (pathSegments: string[], field: CmsFieldSchema) => {
    const path = pathSegments.join(".");
    const request = readDynamicDataSourceRequest(path, field);
    if (request) {
      requests.push(request);
    }

    if (field.type === "array" && field.items && !Array.isArray(field.items) && field.items.properties) {
      for (const [childKey, childField] of Object.entries(field.items.properties)) {
        visit([...pathSegments, childKey], childField as CmsFieldSchema);
      }
      return;
    }

    for (const [childKey, childField] of Object.entries(field.properties ?? {})) {
      visit([...pathSegments, childKey], childField as CmsFieldSchema);
    }
  };

  for (const [key, field] of Object.entries(schema?.properties ?? {})) {
    visit([key], field as CmsFieldSchema);
  }

  return requests;
}

function buildDynamicDataSourceMap(
  requests: DynamicDataSourceRequest[],
  queryResults: Array<{ data?: DataSourceOption[] }>,
) {
  return Object.fromEntries(
    requests.map((request, index) => [request.path, queryResults[index]?.data ?? []]),
  );
}

function buildFilterSchema(
  schema?: CmsModelSchema,
  dynamicDataSources: Record<string, DataSourceOption[]> = {},
) {
  if (!schema?.properties) {
    return undefined;
  }

  const fields = (projectFilterFields(schema, registry) as Array<Omit<FilterFieldProjection, "field">>).map((item) => {
    const field = getLeafFieldByPath(schema, item.path);
    const safeKey = toSafeKey(item.key);
    return {
      ...item,
      safeKey,
      field: (field ?? { type: "string", title: item.title }) as CmsFieldSchema,
    };
  });

  const keyToPath = Object.fromEntries(fields.map((item) => [item.safeKey, item.path]));

  const properties = Object.fromEntries(
    fields.map((item) => {
      const { default: _default, required: _required, ...rest } = item.field;
      const dataSource = dynamicDataSources[item.path] ?? item.dataSource ?? item.field.dataSource;
      return [
        item.safeKey,
        {
          ...rest,
          dataSource,
          title: item.title,
          decorator: "FilterItem",
          props: {
            ...(item.field.props ?? {}),
            ...(item.props ?? {}),
            placeholder: item.props?.placeholder ?? `请输入${item.title}`,
          },
        },
      ];
    }),
  );

  const defaultVisibleKeys = resolveFilterDefaultVisibleKeys(schema, fields);

  return {
    schema: {
      type: "object",
      properties,
    } satisfies CmsModelSchema,
    defaultVisibleKeys,
    keyToPath,
  };
}

function resolveFilterDefaultVisibleKeys(
  schema: CmsModelSchema,
  fields: Array<FilterFieldProjection & { safeKey: string }>,
) {
  const explicitKeys = fields.filter((item) => item.defaultVisible).map((item) => item.safeKey);
  if (explicitKeys.length > 0) {
    return explicitKeys;
  }

  const count = schema["x-model"]?.filter?.count ?? 3;
  return fields
    .slice()
    .sort((left, right) => left.order - right.order)
    .slice(0, count)
    .map((item) => item.safeKey);
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

function buildTableColumns(
  schema?: CmsModelSchema,
  visibleKeys?: string[],
  dynamicDataSources: Record<string, DataSourceOption[]> = {},
) {
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
        dataSource: dynamicDataSources[item.key] ?? item.dataSource,
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
    [dynamicDataSourceRequests, dynamicDataSourceQueries],
  );

  const tableVisibleKeys = useMemo(
    () =>
      sanitizeVisibleKeys(schema, tableVisibleKeysState ?? getDefaultVisibleKeys(schema)),
    [schema, tableVisibleKeysState],
  );

  const filterMeta = useMemo(
    () => buildFilterSchema(schema, dynamicDataSources),
    [schema, dynamicDataSources],
  );
  const filterInitialValues = useMemo(() => {
    const flat = flattenFilterValues(filters);
    return Object.fromEntries(
      Object.entries(flat).map(([flatKey, value]) => [toSafeKey(flatKey), value]),
    );
  }, [filters]);
  const tableColumns = useMemo(
    () => buildTableColumns(schema, tableVisibleKeys, dynamicDataSources),
    [schema, tableVisibleKeys, dynamicDataSources],
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

  // --- Mutations with fine-grained cache invalidation ---

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => createRecord(modelName, values),
    onSuccess: async () => {
      // New record — invalidate list queries for this model
      await queryClient.invalidateQueries({ queryKey: recordQueryKeys.lists(modelName) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      updateRecord(modelName, id, values),
    onSuccess: async (_data, variables) => {
      // Updated record — invalidate its detail + list queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: recordQueryKeys.detail(modelName, variables.id) }),
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

  // --- Action state management ---

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
      // values 使用 filter 表单的 safeKey，先映射回真实点路径再还原为嵌套对象
      const keyToPath = filterMeta?.keyToPath ?? {};
      const flat = Object.fromEntries(
        Object.entries(values).map(([safeKey, value]) => [keyToPath[safeKey] ?? safeKey, value]),
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
