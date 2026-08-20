import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRecord,
  deleteRecord,
  deleteRecords,
  getRecord,
  listRecords,
  updateRecord,
} from "../services";
import type { ModelRecord, Pagination, Sorter } from "../services";

export const recordKeys = {
  all: ["records"] as const,
  model: (model: string) => ["records", model] as const,
  lists: (model: string) => ["records", model, "list"] as const,
  list: (
    model: string,
    filters: Record<string, unknown>,
    pagination: Pagination,
    sorter?: Sorter,
  ) => ["records", model, "list", filters, pagination, sorter] as const,
  detail: (model: string, id?: string) => ["records", model, "detail", id] as const,
};

interface RecordListArgs {
  model: string;
  filters: Record<string, unknown>;
  pagination: Pagination;
  sorter?: Sorter;
  enabled?: boolean;
}

/** 记录列表查询。 */
export function useRecordList({ model, filters, pagination, sorter, enabled = true }: RecordListArgs) {
  return useQuery({
    queryKey: recordKeys.list(model, filters, pagination, sorter),
    enabled,
    queryFn: () => listRecords({ model, filters, pagination, sorter }),
  });
}

/** 单条记录详情。 */
export function useRecordDetail(model: string, id?: string, enabled = true) {
  return useQuery<ModelRecord>({
    queryKey: recordKeys.detail(model, id),
    enabled: Boolean(id) && enabled,
    queryFn: () => getRecord(model, id!),
  });
}

/** 记录的增删改。 */
export function useRecordMutations(model: string) {
  const queryClient = useQueryClient();
  const invalidateLists = () =>
    queryClient.invalidateQueries({ queryKey: recordKeys.lists(model) });

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => createRecord(model, values),
    onSuccess: invalidateLists,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      updateRecord(model, id, values),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: recordKeys.detail(model, variables.id) });
      await invalidateLists();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecord(model, id),
    onSuccess: async (_data, id) => {
      queryClient.removeQueries({ queryKey: recordKeys.detail(model, id) });
      await invalidateLists();
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteRecords(model, ids),
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
