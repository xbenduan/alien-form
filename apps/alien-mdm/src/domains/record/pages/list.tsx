import { Flex } from "antd";
import { useParams } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageRoot, useRuntime } from "@alien-form/engine/react";
import { PageBreadcrumb, PageError, PageLoading } from "../../../components";
import { createAppCompiler } from "../../../compiler/create-compiler";
import { compiledToPageSchema } from "../../../compiler/model-to-page";
import type { Compiled, ModelSchema } from "../../../compiler/shared";

export default function RecordListPage() {
  const { modelName = "" } = useParams();
  return <RecordListContent modelName={modelName} />;
}

function RecordListContent({ modelName }: { modelName: string }) {
  const runtime = useRuntime();
  const compiler = useMemo(() => createAppCompiler("zh", modelName), [modelName]);

  const schemaQuery = useQuery({
    queryKey: ["schema", modelName],
    queryFn: async () => {
      const svc = runtime.registry.services.resolve("schema.get");
      if (!svc) throw new Error("schema.get not registered");
      return (await svc.send({ name: modelName })) as ModelSchema;
    },
  });

  const compiledQuery = useQuery({
    queryKey: ["compiled", modelName],
    enabled: !!schemaQuery.data,
    queryFn: () => compiler.compile(schemaQuery.data!),
  });

  if (schemaQuery.isLoading || compiledQuery.isLoading) return <PageLoading />;
  if (schemaQuery.error || !schemaQuery.data) {
    return (
      <PageError title="模型不存在或加载失败" description={schemaQuery.error?.message} />
    );
  }

  const compiled = compiledQuery.data as Compiled | undefined;
  if (!compiled?.layout) {
    return <PageError title="模型布局协议缺失" description="Schema 必须包含合法的 x-layout。" />;
  }

  const pageSchema = compiledToPageSchema(compiled, schemaQuery.data);

  return (
    <Flex vertical gap={16}>
      <PageBreadcrumb items={[{ title: schemaQuery.data.meta.title }]} />
      <PageRoot schema={pageSchema} />
    </Flex>
  );
}
