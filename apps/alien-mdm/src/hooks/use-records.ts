import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAppRuntime } from "@runtime/create-runtime";
import type { ModelRecord } from "@runtime/types";

export const recordKeys = {
  all: ["records"] as const,
  model: (model: string) => ["records", model] as const,
  lists: (model: string) => ["records", model, "list"] as const,
};

export function useRecordMutations(model: string) {
  const queryClient = useQueryClient();
  const runtime = getAppRuntime();

  const invalidateLists = () =>
    queryClient.invalidateQueries({ queryKey: recordKeys.lists(model) });

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const svc = runtime.registry.services.resolve("records.create");
      if (!svc) throw new Error("records.create not registered");
      return svc.send({ model, values }) as Promise<ModelRecord>;
    },
    onSuccess: () => invalidateLists(),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      const svc = runtime.registry.services.resolve("records.update");
      if (!svc) throw new Error("records.update not registered");
      return svc.send({ model, id, values }) as Promise<ModelRecord>;
    },
    onSuccess: () => invalidateLists(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const svc = runtime.registry.services.resolve("records.delete");
      if (!svc) throw new Error("records.delete not registered");
      return svc.send({ model, id });
    },
    onSuccess: () => invalidateLists(),
  });

  return {
    createRecord: (values: Record<string, unknown>) => createMutation.mutateAsync(values),
    updateRecord: (id: string, values: Record<string, unknown>) =>
      updateMutation.mutateAsync({ id, values }),
    deleteRecord: (id: string) => deleteMutation.mutateAsync(id),
    submitting: createMutation.isPending || updateMutation.isPending,
  };
}
