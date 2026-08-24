import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RuntimeCore } from "../runtime";
import type { ModelRecord, Pagination, RecordListResult, Sorter } from "../runtime";

export const recordKeys = {
  all: ["records"] as const,
  model: (model: string) => ["records", model] as const,
  lists: (model: string) => ["records", model, "list"] as const,
  list: (
    model: string,
    filters: Record<string, unknown>,
    pagination: Pagination,
    sorter?: Sorter,
    refreshVersion?: number,
  ) => ["records", model, "list", filters, pagination, sorter, refreshVersion] as const,
  detail: (model: string, id?: string) => ["records", model, "detail", id] as const,
};

interface RecordListArgs {
  model: string;
  filters: Record<string, unknown>;
  pagination: Pagination;
  sorter?: Sorter;
  refreshVersion?: number;
  enabled?: boolean;
}

/** 记录列表查询。 */
export function useRecordList({
  model,
  filters,
  pagination,
  sorter,
  refreshVersion,
  enabled = true,
}: RecordListArgs) {
  return useQuery({
    queryKey: recordKeys.list(model, filters, pagination, sorter, refreshVersion),
    enabled,
    queryFn: async () => {
      const service = RuntimeCore.current.service.query("records.list", model);
      if (!service) throw new Error("[alien-cms] service records.list 未注册");
      return (await service.send({ model, filters, pagination, sorter })) as RecordListResult;
    },
  });
}

/** 单条记录详情。 */
export function useRecordDetail(model: string, id?: string, enabled = true) {
  return useQuery<ModelRecord>({
    queryKey: recordKeys.detail(model, id),
    enabled: Boolean(id) && enabled,
    queryFn: async () => {
      const service = RuntimeCore.current.service.query("records.get", model);
      if (!service) throw new Error("[alien-cms] service records.get 未注册");
      return (await service.send({ model, id: id! })) as ModelRecord;
    },
  });
}

/** 记录的增删改。 */
export function useRecordMutations(model: string) {
  const queryClient = useQueryClient();
  const invalidateLists = () =>
    queryClient.invalidateQueries({ queryKey: recordKeys.lists(model) });

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const service = RuntimeCore.current.service.query("records.create", model);
      if (!service) throw new Error("[alien-cms] service records.create 未注册");
      return service.send({ model, values }) as Promise<ModelRecord>;
    },
    onSuccess: invalidateLists,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      const service = RuntimeCore.current.service.query("records.update", model);
      if (!service) throw new Error("[alien-cms] service records.update 未注册");
      return service.send({ model, id, values }) as Promise<ModelRecord>;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: recordKeys.detail(model, variables.id) });
      await invalidateLists();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const service = RuntimeCore.current.service.query("records.delete", model);
      if (!service) throw new Error("[alien-cms] service records.delete 未注册");
      return service.send({ model, id });
    },
    onSuccess: async (_data, id) => {
      queryClient.removeQueries({ queryKey: recordKeys.detail(model, id) });
      await invalidateLists();
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const service = RuntimeCore.current.service.query("records.deleteMany", model);
      if (!service) throw new Error("[alien-cms] service records.deleteMany 未注册");
      return service.send({ model, ids });
    },
    onSuccess: async (_data, ids) => {
      ids.forEach((id) => queryClient.removeQueries({ queryKey: recordKeys.detail(model, id) }));
      await invalidateLists();
    },
  });

  return {
    createRecord: (values: Record<string, unknown>) => createMutation.mutateAsync(values),
    updateRecord: (id: string, values: Record<string, unknown>) =>
      updateMutation.mutateAsync({ id, values }),
    deleteRecord: (id: string) => deleteMutation.mutateAsync(id),
    deleteRecords: (ids: string[]) => batchDeleteMutation.mutateAsync(ids),
    submitting: createMutation.isPending || updateMutation.isPending,
    deleting: deleteMutation.isPending || batchDeleteMutation.isPending,
  };
}
