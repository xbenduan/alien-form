import { useQuery } from '@tanstack/react-query';
import type { ModelSummary } from '@alien-form/cms';
import { cmsAppStore } from '../../../services/app-store/cms-app-store';

export function useRecordModelSummaries() {
  return useQuery<ModelSummary[]>({
    queryKey: ['model-summaries'],
    queryFn: async () => {
      const result = await cmsAppStore.schemaProvider().list();
      return result.list;
    },
  });
}
