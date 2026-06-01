import { useQuery } from '@tanstack/react-query';
import { listModelSummaries } from '../core/schema/load-schema';
import type { ModelSummary } from '../types/model';

export function useModelSummaries() {
  return useQuery<ModelSummary[]>({
    queryKey: ['model-summaries'],
    queryFn: listModelSummaries,
  });
}
