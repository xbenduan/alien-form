import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { CompilerProvider, useCompiledSchema } from "../../compiler";
import {
  buildActionPageSchema,
  buildListPageSchema,
  type ModelPageScene,
} from "../../compiler/model-to-page";
import { PageRoot } from "@alien-form/engine/react";
import { PageError, PageLoading } from "@components";
import { useModelSchema } from "@hooks";

export interface RecordRouteProps {
  scene: ModelPageScene;
}

/** URL 参数到通用 runtime 页面的薄适配器。 */
export default function RecordRoute({ scene }: RecordRouteProps) {
  const { modelName = "" } = useParams();
  return (
    <CompilerProvider domain={modelName}>
      <RecordRouteContent scene={scene} />
    </CompilerProvider>
  );
}

/** 编译相关的 hook 必须在 CompilerProvider 内部消费。 */
function RecordRouteContent({ scene }: RecordRouteProps) {
  const { modelName = "", recordId } = useParams();
  const schemaQuery = useModelSchema(modelName);
  const compiledQuery = useCompiledSchema(schemaQuery.data);

  const pageSchema = useMemo(() => {
    if (!schemaQuery.data || !compiledQuery.data) return undefined;
    return scene === "list"
      ? buildListPageSchema(compiledQuery.data, schemaQuery.data)
      : buildActionPageSchema(compiledQuery.data, schemaQuery.data, scene, recordId);
  }, [schemaQuery.data, compiledQuery.data, scene, recordId]);

  if (schemaQuery.isLoading || compiledQuery.isLoading) {
    return <PageLoading />;
  }

  const error = (schemaQuery.error ?? compiledQuery.error) as Error | null;
  if (error || !schemaQuery.data) {
    return <PageError title="模型不存在或加载失败" description={error?.message} />;
  }

  if (!pageSchema) {
    return <PageError title="模型页面编译失败" description="Schema 必须包含可编译的页面布局。" />;
  }

  // service 由字段组件通过引擎 useService/useOptionalService 自取，domain 来自 PageRoot 的 PageProvider。
  return <PageRoot key={pageSchema.id} schema={pageSchema} />;
}
