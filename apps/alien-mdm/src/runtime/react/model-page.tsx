import { useMemo } from "react";
import { PageRoot, useRuntime } from "@alien-form/engine/react";
import { PageError, PageLoading } from "../../components";
import { CompilerProvider, useCompiledSchema } from "../../compiler";
import { FieldServiceContext } from "../../components/service";
import {
  buildActionPageSchema,
  buildListPageSchema,
  type ModelPageScene,
} from "../../compiler/model-to-page";
import { useModelSchema } from "../../hooks";

export interface ModelRuntimePageProps {
  model: string;
  scene: ModelPageScene;
  recordId?: string;
}

function ModelRuntimePageContent({
  model,
  scene,
  recordId,
}: ModelRuntimePageProps) {
  const runtime = useRuntime();
  const schemaQuery = useModelSchema(model);
  const compiledQuery = useCompiledSchema(schemaQuery.data);
  const resolveFieldService = useMemo(
    () => (code: string) => {
      const service = runtime.registry.services.resolve(code, model);
      return service ? { send: (params?: unknown) => service.send(params) } : undefined;
    },
    [runtime, model],
  );

  const pageSchema = useMemo(() => {
    if (!schemaQuery.data || !compiledQuery.data) return undefined;
    return scene === "list"
      ? buildListPageSchema(compiledQuery.data, schemaQuery.data)
      : buildActionPageSchema(
          compiledQuery.data,
          schemaQuery.data,
          scene,
          recordId,
        );
  }, [schemaQuery.data, compiledQuery.data, scene, recordId]);

  if (schemaQuery.isLoading || compiledQuery.isLoading) {
    return <PageLoading />;
  }

  const error = (schemaQuery.error ?? compiledQuery.error) as Error | null;
  if (error || !schemaQuery.data) {
    return (
      <PageError
        title="模型不存在或加载失败"
        description={error?.message}
      />
    );
  }

  if (!pageSchema) {
    return (
      <PageError
        title="模型页面编译失败"
        description="Schema 必须包含可编译的页面布局。"
      />
    );
  }

  return (
    <FieldServiceContext.Provider value={resolveFieldService}>
      <PageRoot key={pageSchema.id} schema={pageSchema} />
    </FieldServiceContext.Provider>
  );
}

/**
 * 应用层的通用 runtime 页面宿主。
 * 输入仅为 model + scene + route data；路由、breadcrumb 与具体 UI 均不在此实现。
 */
export function ModelRuntimePage(props: ModelRuntimePageProps) {
  return (
    <CompilerProvider domain={props.model}>
      <ModelRuntimePageContent {...props} />
    </CompilerProvider>
  );
}

export type { ModelPageScene };
