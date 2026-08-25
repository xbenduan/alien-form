import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LAYOUT_SERVICE_KEYS } from "@alien-form/shared";
import type { ServiceCtx } from "../runtime";
import { resolveLayoutService } from "../runtime";
import type { ModelRecord, Pagination, RecordListResult, Sorter } from "../runtime/types";

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
  filters: Record<string, unknown>;
  pagination: Pagination;
  sorter?: Sorter;
  refreshVersion?: number;
  enabled?: boolean;
}

/** 树子树查询：service 由 query.subtree 声明，返回扁平节点列表。 */
export function useRecordSubtree(
  ctx: ServiceCtx,
  {
    model,
    idField,
    parentField,
    parentValue,
    enabled = true,
  }: {
    model: string;
    idField?: string;
    parentField?: string;
    parentValue?: string | null;
    enabled?: boolean;
  },
) {
  return useQuery({
    queryKey: ["records", model, "subtree", idField, parentField, parentValue] as const,
    enabled,
    queryFn: async () => {
      const service = resolveLayoutService(ctx, LAYOUT_SERVICE_KEYS.SUBTREE);
      return (await service.send({ model, idField, parentField, parentValue })) as {
        list: ModelRecord[];
      };
    },
  });
}

/** 列表查询：service 由布局根节点 props.services[query.list] 声明。 */
export function useRecordListQuery(
  ctx: ServiceCtx,
  { filters, pagination, sorter, refreshVersion, enabled = true }: RecordListArgs,
) {
  return useQuery({
    queryKey: recordKeys.list(ctx.model, filters, pagination, sorter, refreshVersion),
    enabled,
    queryFn: async () => {
      const service = resolveLayoutService(ctx, LAYOUT_SERVICE_KEYS.LIST);
      return (await service.send({ model: ctx.model, filters, pagination, sorter })) as RecordListResult;
    },
  });
}

/** 单条详情：service 由 query.detail 声明。 */
export function useRecordDetailQuery(ctx: ServiceCtx, id?: string, enabled = true) {
  return useQuery<ModelRecord>({
    queryKey: recordKeys.detail(ctx.model, id),
    enabled: Boolean(id) && enabled,
    queryFn: async () => {
      const service = resolveLayoutService(ctx, LAYOUT_SERVICE_KEYS.DETAIL);
      return (await service.send({ model: ctx.model, id: id! })) as ModelRecord;
    },
  });
}

/** 记录的增删改：service 由 create/update/delete 语义 key 声明。 */
export function useRecordMutations(ctx: ServiceCtx) {
  const queryClient = useQueryClient();
  const invalidateLists = () =>
    queryClient.invalidateQueries({ queryKey: recordKeys.lists(ctx.model) });
  const bumpRefresh = () => ctx.scope?.refresh();

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const service = resolveLayoutService(ctx, LAYOUT_SERVICE_KEYS.CREATE);
      return service.send({ model: ctx.model, values }) as Promise<ModelRecord>;
    },
    onSuccess: () => {
      bumpRefresh();
      return invalidateLists();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      const service = resolveLayoutService(ctx, LAYOUT_SERVICE_KEYS.UPDATE);
      return service.send({ model: ctx.model, id, values }) as Promise<ModelRecord>;
    },
    onSuccess: async (_data, variables) => {
      bumpRefresh();
      await queryClient.invalidateQueries({ queryKey: recordKeys.detail(ctx.model, variables.id) });
      await invalidateLists();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const service = resolveLayoutService(ctx, LAYOUT_SERVICE_KEYS.DELETE);
      return service.send({ model: ctx.model, id });
    },
    onSuccess: async (_data, id) => {
      bumpRefresh();
      queryClient.removeQueries({ queryKey: recordKeys.detail(ctx.model, id) });
      await invalidateLists();
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const service = resolveLayoutService(ctx, LAYOUT_SERVICE_KEYS.DELETE_MANY);
      return service.send({ model: ctx.model, ids });
    },
    onSuccess: async (_data, ids) => {
      bumpRefresh();
      ids.forEach((id) => queryClient.removeQueries({ queryKey: recordKeys.detail(ctx.model, id) }));
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
