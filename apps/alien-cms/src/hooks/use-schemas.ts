import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSchema,
  deleteSchema,
  getSchema,
  listSchemas,
  updateSchema,
} from "../services";
import type { ModelSchema } from "../services";

export const schemaKeys = {
  all: ["schemas"] as const,
  summaries: ["schemas", "summaries"] as const,
  detail: (name?: string) => ["schemas", "detail", name] as const,
};

/** 所有模型摘要（落地页）。 */
export function useModelSummaries() {
  return useQuery({ queryKey: schemaKeys.summaries, queryFn: listSchemas });
}

/** 单个模型 schema 详情。 */
export function useModelSchema(name?: string) {
  return useQuery({
    queryKey: schemaKeys.detail(name),
    enabled: Boolean(name),
    queryFn: () => getSchema(name!),
  });
}

/** 模型的增删改。 */
export function useSchemaMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: schemaKeys.summaries }),
      queryClient.invalidateQueries({ queryKey: schemaKeys.all }),
    ]);

  const createMutation = useMutation({
    mutationFn: (schema: ModelSchema) => createSchema(schema),
    onSuccess: invalidateAll,
  });

  const updateMutation = useMutation({
    mutationFn: ({ name, schema }: { name: string; schema: ModelSchema }) =>
      updateSchema(name, schema),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: schemaKeys.detail(variables.name) });
      await invalidateAll();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => deleteSchema(name),
    onSuccess: async (_data, name) => {
      queryClient.removeQueries({ queryKey: schemaKeys.detail(name) });
      await invalidateAll();
    },
  });

  return {
    createModel: (schema: ModelSchema) => createMutation.mutateAsync(schema),
    updateModel: (name: string, schema: ModelSchema) =>
      updateMutation.mutateAsync({ name, schema }),
    deleteModel: (name: string) => deleteMutation.mutateAsync(name),
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}
