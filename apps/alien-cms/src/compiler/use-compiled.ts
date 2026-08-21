import { useQuery } from "@tanstack/react-query";
import type { Compiled, ModelSchema } from "@alien-form/shared";
import { useCompiler } from "./CompilerProvider";

/**
 * 编译一份 schema → 一次出全套（form / filter / table + meta）。
 * schema 已在手（如构建器预览）时用此 hook；resolveData 控制是否真实预取外键。
 */
export function useCompiledSchema(schema: ModelSchema | undefined, resolveData = true) {
  const compiler = useCompiler();
  return useQuery<Compiled>({
    queryKey: ["compiled", schema?.meta.name, resolveData, schema],
    enabled: Boolean(schema),
    queryFn: () => compiler.compile(schema!, { resolveData }),
  });
}
