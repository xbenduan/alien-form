import { useEffect, useMemo, useState } from "react";
import { useModelSchema, useSchemaMutations } from "../../../hooks";
import { useCompiler } from "../../../compiler";
import type { ModelDraft } from "../types";

/**
 * 模型构建器状态：new / edit 共用。
 * edit 模式下从远端 schema 反解析为草稿；预览态实时 build 出 ModelSchema。
 * draft ⇄ schema 双向映射统一走当前 domain 的 SchemaCompiler 实例。
 */
export function useModelBuilder(editName?: string) {
  const compiler = useCompiler();
  const isEdit = Boolean(editName);
  const schemaQuery = useModelSchema(editName);
  const mutations = useSchemaMutations();
  const [draft, setDraft] = useState<ModelDraft>(() => compiler.createEmptyDraft());

  useEffect(() => {
    if (isEdit && schemaQuery.data) {
      setDraft(compiler.toDraft(schemaQuery.data));
    }
  }, [compiler, isEdit, schemaQuery.data]);

  const preview = useMemo(() => {
    try {
      return { schema: compiler.toSchema(draft), error: undefined as string | undefined };
    } catch (error) {
      return {
        schema: undefined,
        error: error instanceof Error ? error.message : "预览生成失败",
      };
    }
  }, [compiler, draft]);

  const save = async () => {
    const schema = compiler.toSchema(draft);
    if (isEdit && editName) await mutations.updateSchema(editName, schema);
    else await mutations.createSchema(schema);
  };

  return {
    isEdit,
    draft,
    setDraft,
    preview,
    loading: isEdit && schemaQuery.isLoading,
    loadError: schemaQuery.error as Error | null,
    saving: false,
    save,
  };
}
