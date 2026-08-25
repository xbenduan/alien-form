import { useQuery } from "@tanstack/react-query";
import { useModelSchema } from "../../../hooks";
import { useCompiler } from "../../../compiler";

export function useRecordPage(modelName: string) {
  const compiler = useCompiler();
  const schemaQuery = useModelSchema(modelName);

  const compiledQuery = useQuery({
    queryKey: ["compiled", modelName],
    enabled: !!schemaQuery.data,
    queryFn: () => compiler.compile(schemaQuery.data!),
  });

  return {
    modelName,
    schema: schemaQuery.data,
    compiled: compiledQuery.data,
    schemaLoading: schemaQuery.isLoading || compiledQuery.isLoading,
    schemaError: (schemaQuery.error ?? compiledQuery.error) as Error | null,
  };
}
