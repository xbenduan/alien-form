import { createSchema, deleteSchema, getSchema, listSchemas, updateSchema } from "@alien-form/cms";
import type { CmsModelSchema, SchemaListFilters } from "@alien-form/cms";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

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
  });
}

export function useSchemaDetail(modelName?: string) {
  return useQuery<CmsModelSchema>({
    queryKey: schemaQueryKeys.detail(modelName),
    enabled: Boolean(modelName),
    queryFn: () => getSchema(modelName!),
  });
}

export function useSchemaMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (schema: CmsModelSchema) => createSchema(schema),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: schemaQueryKeys.summaries }),
        queryClient.invalidateQueries({ queryKey: ["schemas", "list"] }),
      ]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ modelName, schema }: { modelName: string; schema: CmsModelSchema }) =>
      updateSchema(modelName, schema),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: schemaQueryKeys.detail(variables.modelName) }),
        queryClient.invalidateQueries({ queryKey: schemaQueryKeys.summaries }),
        queryClient.invalidateQueries({ queryKey: ["schemas", "list"] }),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (modelName: string) => deleteSchema(modelName),
    onSuccess: async (_data, modelName) => {
      queryClient.removeQueries({ queryKey: schemaQueryKeys.detail(modelName) });
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
