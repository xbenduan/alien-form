import { useQuery } from '@tanstack/react-query';
import type { ModelSummary } from '@alien-form/cms';
import { listModelSummaries } from '../data/cms-data-access';

export function useModelSummaries() {
  return useQuery<ModelSummary[]>({
    queryKey: ['model-summaries'],
    queryFn: listModelSummaries,
  });
}
