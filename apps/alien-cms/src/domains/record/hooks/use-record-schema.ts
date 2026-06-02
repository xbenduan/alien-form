import { useQuery } from '@tanstack/react-query';
import type { CmsModelSchema } from '@alien-form/cms';
import { cmsAppStore } from '../../../services/app-store/cms-app-store';

export function useRecordSchema(modelName: string) {
  return useQuery<CmsModelSchema>({
    queryKey: ['model-schema', modelName],
    queryFn: () => cmsAppStore.schemaProvider().detail({ modelName }),
    enabled: Boolean(modelName),
  });
}
