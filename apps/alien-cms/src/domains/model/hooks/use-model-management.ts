import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { CmsModelSchema, ModelSummary } from '@alien-form/cms';
import { cmsAppStore } from '../../../services/app-store/cms-app-store';

export function useModelManagement() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [previewModelName, setPreviewModelName] = useState<string>();

  const listQuery = useQuery({
    queryKey: ['model-management', keyword, pagination.current, pagination.pageSize],
    queryFn: async () => cmsAppStore.schemaProvider().list({
      keyword,
      pagination,
    }),
  });

  const previewQuery = useQuery<CmsModelSchema>({
    queryKey: ['model-schema-preview', previewModelName],
    enabled: Boolean(previewModelName),
    queryFn: async () => cmsAppStore.schemaProvider().detail({
      modelName: previewModelName!,
    }),
  });

  const summaryMap = useMemo(
    () => new Map((listQuery.data?.list ?? []).map((item) => [item.name, item] satisfies [string, ModelSummary])),
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
    deleteModel: async (modelName: string) => {
      const result = await cmsAppStore.schemaProvider().delete({ modelName });
      if (!result.success) {
        throw new Error('删除模型失败');
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['model-management'] }),
        queryClient.invalidateQueries({ queryKey: ['model-summaries'] }),
        queryClient.invalidateQueries({ queryKey: ['model-schema', modelName] }),
      ]);
    },
  };
}
