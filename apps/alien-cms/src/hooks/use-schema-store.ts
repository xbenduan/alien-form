import { createSchema, deleteSchema, getSchema, listSchemas, updateSchema } from "@alien-form/cms";
import type { CmsModelSchema, SchemaListFilters } from "@alien-form/cms";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

// 5 minutes stale time to reduce redundant large JSON fetches
const SCHEMA_STALE_TIME = 5 * 60 * 1000;
// Keep unused schema data in cache for 10 minutes
const SCHEMA_GC_TIME = 10 * 60 * 1000;

export const schemaQueryKeys = {
  all: ["schemas"] as const,
  summaries: ["schemas", "summaries"] as const,
  list: (filters: SchemaListFilters, current: number, pageSize: number) =>
    ["schemas", "list", filters, current, pageSize] as const,
  detail: (modelName?: string) => ["schemas", "detail", modelName] as const,
};

export function useModelSummaries() {
  return useQuery({
    queryKey: schemaQueryKeys.summaries,
    queryFn: async () => {
      const result = await listSchemas();
      return result.list;
    },
    staleTime: SCHEMA_STALE_TIME,
    gcTime: SCHEMA_GC_TIME,
  });
}

export function useSchemaList(options: {
  filters: SchemaListFilters;
  current: number;
  pageSize: number;
}) {
  const { filters, current, pageSize } = options;
  return useQuery({
    queryKey: schemaQueryKeys.list(filters, current, pageSize),
    queryFn: () =>
      listSchemas({
        filters,
        pagination: {
          current,
          pageSize,
        },
      }),
    staleTime: SCHEMA_STALE_TIME,
    gcTime: SCHEMA_GC_TIME,
  });
}

export function useSchemaDetail(modelName?: string) {
  return useQuery<CmsModelSchema>({
    queryKey: schemaQueryKeys.detail(modelName),
    enabled: Boolean(modelName),
    queryFn: () => getSchema(modelName!),
    staleTime: SCHEMA_STALE_TIME,
    gcTime: SCHEMA_GC_TIME,
  });
}

export function useSchemaMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (schema: CmsModelSchema) => createSchema(schema),
    onSuccess: async (_, schema) => {
      const modelName = schema["x-model"]?.name;
      // Optimistically set the detail cache with the schema we just created
      if (modelName) {
        queryClient.setQueryData(schemaQueryKeys.detail(modelName), schema);
      }
      // Invalidate list queries to refresh summaries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: schemaQueryKeys.summaries }),
        queryClient.invalidateQueries({ queryKey: ["schemas", "list"] }),
      ]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ modelName, schema }: { modelName: string; schema: CmsModelSchema }) =>
      updateSchema(modelName, schema),
    onMutate: async ({ modelName, schema }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: schemaQueryKeys.detail(modelName) });

      // Snapshot the previous value
      const previousSchema = queryClient.getQueryData<CmsModelSchema>(
        schemaQueryKeys.detail(modelName),
      );

      // Optimistically update the cache
      queryClient.setQueryData(schemaQueryKeys.detail(modelName), schema);

      return { previousSchema, modelName };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousSchema) {
        queryClient.setQueryData(
          schemaQueryKeys.detail(context.modelName),
          context.previousSchema,
        );
      }
    },
    onSettled: async (_data, _error, variables) => {
      // Always refetch list data after mutation settles
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: schemaQueryKeys.summaries }),
        queryClient.invalidateQueries({ queryKey: ["schemas", "list"] }),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (modelName: string) => deleteSchema(modelName),
    onMutate: async (modelName) => {
      // Remove detail from cache immediately
      queryClient.removeQueries({ queryKey: schemaQueryKeys.detail(modelName) });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: schemaQueryKeys.summaries }),
        queryClient.invalidateQueries({ queryKey: ["schemas", "list"] }),
        queryClient.invalidateQueries({ queryKey: ["records"] }),
      ]);
    },
  });

  return {
    createModel: async (schema: CmsModelSchema) => createMutation.mutateAsync(schema),
    updateModel: async (modelName: string, schema: CmsModelSchema) =>
      updateMutation.mutateAsync({ modelName, schema }),
    deleteModel: async (modelName: string) => deleteMutation.mutateAsync(modelName),
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}

export function useSchemaStore() {
  const [filters, setFilters] = useState<SchemaListFilters>({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [previewModelName, setPreviewModelName] = useState<string>();
  const listQuery = useSchemaList({
    filters,
    current: pagination.current,
    pageSize: pagination.pageSize,
  });
  const previewQuery = useSchemaDetail(previewModelName);
  const mutations = useSchemaMutations();

  const summaryMap = useMemo(
    () =>
      new Map((listQuery.data?.list ?? []).map((item) => [item.name, item] as const)),
    [listQuery.data?.list],
  );

  return {
    filters,
    setFilters,
    pagination,
    setPagination,
    list: listQuery.data?.list ?? [],
    total: listQuery.data?.total ?? 0,
    loading: listQuery.isLoading || listQuery.isFetching,
    error: listQuery.error,
    previewModelName,
    setPreviewModelName,
    previewSchema: previewQuery.data,
    previewLoading: previewQuery.isLoading || previewQuery.isFetching,
    previewError: previewQuery.error,
    getSummary: (modelName: string) => summaryMap.get(modelName),
    deleteModel: mutations.deleteModel,
  };
}
