import { useEffect, useMemo, useState } from "react";
import { useModelSchema, useSchemaMutations } from "../../../hooks";
import { buildModelSchema, createEmptyDraft, schemaToDraft } from "../utils";
import type { ModelDraft } from "../types";

/**
 * 模型构建器状态：new / edit 共用。
 * edit 模式下从远端 schema 反解析为草稿；预览态实时 build 出 ModelSchema。
 */
export function useModelBuilder(editName?: string) {
  const isEdit = Boolean(editName);
  const schemaQuery = useModelSchema(editName);
  const mutations = useSchemaMutations();
  const [draft, setDraft] = useState<ModelDraft>(createEmptyDraft);

  useEffect(() => {
    if (isEdit && schemaQuery.data) {
      setDraft(schemaToDraft(schemaQuery.data));
    }
  }, [isEdit, schemaQuery.data]);

  const preview = useMemo(() => {
    try {
      return { schema: buildModelSchema(draft), error: undefined as string | undefined };
    } catch (error) {
      return {
        schema: undefined,
        error: error instanceof Error ? error.message : "预览生成失败",
      };
    }
  }, [draft]);

  const save = async () => {
    const schema = buildModelSchema(draft);
    if (isEdit && editName) await mutations.updateModel(editName, schema);
    else await mutations.createModel(schema);
  };

  return {
    isEdit,
    draft,
    setDraft,
    preview,
    loading: isEdit && schemaQuery.isLoading,
    loadError: schemaQuery.error as Error | null,
    saving: mutations.creating || mutations.updating,
    save,
  };
}
