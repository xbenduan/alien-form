import { createSchema, deleteSchema, getSchema, listSchemas, updateSchema } from "@alien-form/cms";
import type { CmsModelSchema } from "@alien-form/cms";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

export const schemaQueryKeys = {
  all: ["schemas"] as const,
  summaries: ["schemas", "summaries"] as const,
  list: (keyword: string, current: number, pageSize: number) =>
    ["schemas", "list", keyword, current, pageSize] as const,
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

export function useSchemaList(options: { keyword: string; current: number; pageSize: number }) {
  const { keyword, current, pageSize } = options;
  return useQuery({
    queryKey: schemaQueryKeys.list(keyword, current, pageSize),
    queryFn: () =>
      listSchemas({
        keyword,
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

  const invalidateSchemaQueries = async (modelName?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: schemaQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["records"] }),
      modelName
        ? queryClient.invalidateQueries({ queryKey: schemaQueryKeys.detail(modelName) })
        : Promise.resolve(),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (schema: CmsModelSchema) => createSchema(schema),
    onSuccess: async (_, schema) => {
      await invalidateSchemaQueries(schema["x-model"]?.name);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ modelName, schema }: { modelName: string; schema: CmsModelSchema }) =>
      updateSchema(modelName, schema),
    onSuccess: async (_, variables) => {
      await invalidateSchemaQueries(variables.modelName);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (modelName: string) => deleteSchema(modelName),
    onSuccess: async (_, modelName) => {
      await invalidateSchemaQueries(modelName);
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
  const [keyword, setKeyword] = useState("");
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [previewModelName, setPreviewModelName] = useState<string>();
  const listQuery = useSchemaList({
    keyword,
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
    keyword,
    setKeyword,
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

