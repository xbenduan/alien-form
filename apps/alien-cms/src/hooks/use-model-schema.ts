import { useQuery } from '@tanstack/react-query';
import { loadSchema } from '../core/schema/load-schema';
import type { CmsModelSchema } from '../types/model';

export function useModelSchema(modelName: string) {
  return useQuery<CmsModelSchema>({
    queryKey: ['model-schema', modelName],
    queryFn: () => loadSchema(modelName),
    enabled: Boolean(modelName),
  });
}
