import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RuntimeCore } from "../runtime";
import type { ModelSchema, ModelSummary } from "../runtime";

export const schemaKeys = {
  all: ["schemas"] as const,
  summaries: ["schemas", "summaries"] as const,
  detail: (name?: string) => ["schemas", "detail", name] as const,
};

/** 所有模型摘要（落地页）。 */
export function useModelSummaries() {
  return useQuery({
    queryKey: schemaKeys.summaries,
    queryFn: async () => {
      const service = RuntimeCore.current.service.query("schema.list");
      if (!service) throw new Error("[alien-cms] service schema.list 未注册");
      return (await service.send()) as ModelSummary[];
    },
  });
}

/** 单个模型 schema 详情。 */
export function useModelSchema(name?: string) {
  return useQuery({
    queryKey: schemaKeys.detail(name),
    enabled: Boolean(name),
    queryFn: async () => {
      const service = RuntimeCore.current.service.query("schema.get");
      if (!service) throw new Error("[alien-cms] service schema.get 未注册");
      return (await service.send({ name: name! })) as ModelSchema;
    },
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
    mutationFn: async (schema: ModelSchema) => {
      const service = RuntimeCore.current.service.query("schema.create");
      if (!service) throw new Error("[alien-cms] service schema.create 未注册");
      return service.send(schema) as Promise<ModelSchema>;
    },
    onSuccess: invalidateAll,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ name, schema }: { name: string; schema: ModelSchema }) => {
      const service = RuntimeCore.current.service.query("schema.update");
      if (!service) throw new Error("[alien-cms] service schema.update 未注册");
      return service.send({ name, schema }) as Promise<ModelSchema>;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: schemaKeys.detail(variables.name) });
      await invalidateAll();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (name: string) => {
      const service = RuntimeCore.current.service.query("schema.delete");
      if (!service) throw new Error("[alien-cms] service schema.delete 未注册");
      return service.send({ name });
    },
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
