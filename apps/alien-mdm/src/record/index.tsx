import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageRoot } from "@alien-form/engine/react";
import { PageBreadcrumb, PageError, PageLoading } from "../components";
import { CompilerProvider, useCompiler } from "../compiler";
import { useModelSchema } from "../hooks";
import {
  buildActionPageSchema,
  buildListPageSchema,
} from "../compiler/model-to-page";
import { recordListPath } from "../app/router/paths";
import type { ActionMode } from "../app/router/routes";
import styles from "../register/global/ui.module.css";

/**
 * 记录页：完全由 runtime 承接的实例——不再手写 list / actions，
 * 只负责「拉取模型 schema → 编译 → 组装 PageSchema → 交给 PageRoot」。
 * 列表、增删改查、详情/编辑/删除交互全部由已注册组件 + block 运行时驱动。
 */

const ACTION_TITLE: Record<ActionMode, string> = {
  add: "新增",
  edit: "编辑",
  detail: "详情",
};

/** 复用一次编译产物（form/filter/columns/layout）。 */
function useCompiledModel(modelName: string) {
  const compiler = useCompiler();
  const schemaQuery = useModelSchema(modelName);
  const compiledQuery = useQuery({
    queryKey: ["compiled", modelName],
    enabled: Boolean(schemaQuery.data),
    queryFn: () => compiler.compile(schemaQuery.data!),
  });
  return {
    schema: schemaQuery.data,
    compiled: compiledQuery.data,
    loading: schemaQuery.isLoading || compiledQuery.isLoading,
    error: (schemaQuery.error ?? compiledQuery.error) as Error | null,
  };
}

function RecordListContent({ modelName }: { modelName: string }) {
  const { schema, compiled, loading, error } = useCompiledModel(modelName);

  if (loading) return <PageLoading />;
  if (error || !schema) {
    return <PageError title="模型不存在或加载失败" description={error?.message} />;
  }
  if (!compiled?.layout) {
    return <PageError title="模型布局协议缺失" description="Schema 必须包含合法的 x-layout。" />;
  }

  const pageSchema = buildListPageSchema(compiled, schema);

  return (
    <div className={styles.recordRoute}>
      <PageBreadcrumb items={[{ title: schema.meta.title }]} />
      <PageRoot schema={pageSchema} />
    </div>
  );
}

export default function RecordListPage() {
  const { modelName = "" } = useParams();
  return (
    <CompilerProvider domain={modelName}>
      <RecordListContent modelName={modelName} />
    </CompilerProvider>
  );
}

function RecordActionContent({ mode }: { mode: ActionMode }) {
  const { modelName = "", recordId } = useParams();
  const { schema, compiled, loading, error } = useCompiledModel(modelName);

  if (loading) return <PageLoading />;
  if (error || !schema || !compiled) {
    return <PageError title="模型不存在或加载失败" description={error?.message} />;
  }

  const pageSchema = buildActionPageSchema(compiled, schema, mode, recordId);

  return (
    <div className={`${styles.recordRoute} ${styles.actionRoute}`}>
      <PageBreadcrumb
        items={[
          { title: `${schema.meta.singularLabel}列表`, to: recordListPath(modelName) },
          { title: `${ACTION_TITLE[mode]}${schema.meta.singularLabel}` },
        ]}
      />
      <PageRoot schema={pageSchema} />
    </div>
  );
}

export function RecordActionPage({ mode }: { mode: ActionMode }) {
  const { modelName = "", recordId } = useParams();
  // recordId 变化时重建 PageRoot，避免旧 detail/edit 表单残留。
  const key = useMemo(() => `${modelName}-${mode}-${recordId ?? "new"}`, [modelName, mode, recordId]);
  return (
    <CompilerProvider key={key} domain={modelName}>
      <RecordActionContent mode={mode} />
    </CompilerProvider>
  );
}
