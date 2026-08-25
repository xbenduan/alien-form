import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAppRuntime } from "../runtime/create-runtime";
import type { ModelSchema } from "../compiler/shared";
import type { ModelSummary } from "../runtime/types";

export const schemaKeys = {
  all: ["schemas"] as const,
  summaries: ["schemas", "summaries"] as const,
  detail: (name?: string) => ["schemas", "detail", name] as const,
};

export function useModelSummaries() {
  const runtime = getAppRuntime();
  return useQuery({
    queryKey: schemaKeys.summaries,
    queryFn: async () => {
      const svc = runtime.registry.services.resolve("schema.list");
      if (!svc) throw new Error("schema.list not registered");
      return (await svc.send()) as ModelSummary[];
    },
  });
}

export function useModelSchema(name?: string) {
  const runtime = getAppRuntime();
  return useQuery({
    queryKey: schemaKeys.detail(name),
    enabled: Boolean(name),
    queryFn: async () => {
      const svc = runtime.registry.services.resolve("schema.get");
      if (!svc) throw new Error("schema.get not registered");
      return (await svc.send({ name })) as ModelSchema;
    },
  });
}

export function useSchemaMutations() {
  const queryClient = useQueryClient();
  const runtime = getAppRuntime();

  const createMutation = useMutation({
    mutationFn: async (schema: ModelSchema) => {
      const svc = runtime.registry.services.resolve("schema.create");
      if (!svc) throw new Error("schema.create not registered");
      return svc.send(schema) as Promise<ModelSchema>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schemaKeys.all }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ name, schema }: { name: string; schema: ModelSchema }) => {
      const svc = runtime.registry.services.resolve("schema.update");
      if (!svc) throw new Error("schema.update not registered");
      return svc.send({ name, schema }) as Promise<ModelSchema>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schemaKeys.all }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (name: string) => {
      const svc = runtime.registry.services.resolve("schema.delete");
      if (!svc) throw new Error("schema.delete not registered");
      return svc.send({ name });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schemaKeys.all }),
  });

  return {
    createSchema: (schema: ModelSchema) => createMutation.mutateAsync(schema),
    updateSchema: (name: string, schema: ModelSchema) =>
      updateMutation.mutateAsync({ name, schema }),
    deleteSchema: (name: string) => deleteMutation.mutateAsync(name),
  };
}
