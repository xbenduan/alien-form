import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { PageRoot } from "@alien-form/engine/react";
import { PageError, PageLoading } from "@components";
import { useModelSchema } from "@hooks";
import {
  buildModelPage,
  type ModelPageScene,
} from "../../domains/model/builder";

export interface RecordRouteProps {
  scene: ModelPageScene;
}

export default function RecordRoute({ scene }: RecordRouteProps) {
  const { modelName = "", recordId } = useParams();
  const schemaQuery = useModelSchema(modelName);
  const pageSchema = useMemo(
    () =>
      schemaQuery.data
        ? buildModelPage({ schema: schemaQuery.data, scene, recordId })
        : undefined,
    [recordId, scene, schemaQuery.data],
  );

  if (schemaQuery.isLoading) return <PageLoading />;
  if (schemaQuery.error || !schemaQuery.data) {
    const error = schemaQuery.error as Error | null;
    return <PageError title="模型不存在或加载失败" description={error?.message} />;
  }
  if (!pageSchema) {
    return <PageError title="模型页面构建失败" description="Schema 必须包含有效页面布局。" />;
  }
  return <PageRoot key={pageSchema.id} schema={pageSchema} />;
}
