import { useQuery } from '@tanstack/react-query';
import type { CmsModelSchema } from '@alien-form/cms';
import { loadSchema } from '../data/cms-data-access';

export function useModelSchema(modelName: string) {
  return useQuery<CmsModelSchema>({
    queryKey: ['model-schema', modelName],
    queryFn: () => loadSchema(modelName),
    enabled: Boolean(modelName),
  });
}
