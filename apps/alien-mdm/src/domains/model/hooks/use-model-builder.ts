import { useEffect, useMemo } from "react";
import { BuilderRuntime } from "@alien-form/builder";
import { useBuilderAtom } from "@alien-form/builder/react";
import { useModelSchema, useSchemaMutations } from "@hooks";
import { fieldDefinitionRegistry } from "../../../register/global/form/registry";
import { ModelCodec, modelCommands, type ModelDraft } from "../builder";

function validate(draft: ModelDraft) {
  const errors: Array<{ path: string; message: string }> = [];
  if (!draft.name.trim()) errors.push({ path: "name", message: "请填写模型名" });
  if (draft.name && !/^[a-z][a-z0-9-]*$/.test(draft.name.trim())) {
    errors.push({
      path: "name",
      message: "模型名仅支持小写字母、数字和中划线，且以字母开头",
    });
  }
  return errors;
}

export function useModelBuilder(editName?: string) {
  const isEdit = Boolean(editName);
  const schemaQuery = useModelSchema(editName);
  const mutations = useSchemaMutations();
  const codec = useMemo(() => new ModelCodec(), []);
  const runtime = useMemo(
    () =>
      new BuilderRuntime<ModelDraft>({
        document: codec.createModel(),
        registry: fieldDefinitionRegistry,
        commands: modelCommands,
        validate,
      }),
    [codec],
  );
  const document = useBuilderAtom(runtime.document);
  const dirty = useBuilderAtom(runtime.dirty);
  const errors = useBuilderAtom(runtime.errors);
  const saving = useBuilderAtom(runtime.saving);
  const canUndo = useBuilderAtom(runtime.canUndo);
  const canRedo = useBuilderAtom(runtime.canRedo);

  useEffect(() => {
    if (isEdit && schemaQuery.data) runtime.reset(codec.decode(schemaQuery.data));
  }, [codec, isEdit, runtime, schemaQuery.data]);

  const preview = useMemo(() => {
    try {
      return { schema: codec.encode(document), error: undefined as string | undefined };
    } catch (error) {
      return {
        schema: undefined,
        error: error instanceof Error ? error.message : "预览生成失败",
      };
    }
  }, [codec, document]);

  const save = async () => {
    const schema = codec.encode(runtime.document.get());
    runtime.setSaving(true);
    try {
      if (isEdit && editName) await mutations.updateSchema(editName, schema);
      else await mutations.createSchema(schema);
      runtime.markClean();
    } finally {
      runtime.setSaving(false);
    }
  };

  return {
    runtime,
    codec,
    isEdit,
    document,
    dirty,
    errors,
    canUndo,
    canRedo,
    preview,
    loading: isEdit && schemaQuery.isLoading,
    loadError: schemaQuery.error as Error | null,
    saving,
    save,
  };
}
