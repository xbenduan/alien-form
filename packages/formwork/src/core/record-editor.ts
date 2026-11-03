import { createMemo, createResource, createSignal, onCleanup, untrack } from "solid-js";
import type { Accessor } from "solid-js";
import { checkAbort, FormworkError } from "../model/errors";
import { escapePointer, isObject } from "../model/pointer";
import type { ObjectSchema, RecordPatch, RecordValue } from "../model/types";
import { createModelResource, loadModel, useRuntime } from "./context";
import type { ModelContext, ModelOptions, RecordOperation } from "./types";
import type { RecordSnapshot } from "../data/index";

function equal(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((item, index) => equal(item, right[index]));
  if (isObject(left) && isObject(right))
    return (
      Object.keys(left).length === Object.keys(right).length &&
      Object.keys(left).every((key) => Object.hasOwn(right, key) && equal(left[key], right[key]))
    );
  return false;
}
function writable(model: ModelContext, mode: "create" | "edit"): ObjectSchema {
  const schema = structuredClone(model.model.valueSchema);
  const action = mode === "create" ? "create" : "update";
  for (const [key, field] of Object.entries(schema.properties)) {
    if (!model.snapshot.capabilities.fields[`/${escapePointer(key)}`]?.[action])
      field.readOnly = true;
  }
  if (mode === "create")
    schema.required = schema.required?.filter((key) => !schema.properties[key]?.readOnly);
  return schema;
}
function projection(model: ModelContext, value: RecordValue, mode: "create" | "edit"): RecordValue {
  const schema = writable(model, mode);
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => {
      const field = schema.properties[key];
      return field && !field.readOnly;
    }),
  );
}
/** 只比较可写根字段，unset 保留「删除」与 null 的区别。 */
export function recordChanges(
  model: ModelContext,
  original: RecordValue,
  value: RecordValue,
): RecordPatch {
  const before = projection(model, original, "edit");
  const after = projection(model, value, "edit");
  return {
    set: Object.fromEntries(
      Object.entries(after).filter(([key, value]) => !equal(before[key], value)),
    ),
    unset: Object.keys(before)
      .filter((key) => !Object.hasOwn(after, key))
      .map((key) => `/${escapePointer(key)}`),
  };
}
/** 读取与模型版本一致的单条记录；只重取一次，避免持续冲突导致循环。 */
export async function readConsistentRecord(
  model: ModelContext,
  recordId: string,
  signal: AbortSignal,
  reload: () => Promise<ModelContext>,
): Promise<{ model: ModelContext; record: RecordSnapshot }> {
  let record = await model.data.getRecord({ modelId: model.modelId, recordId }, { signal });
  if (record.schemaRevision !== model.snapshot.schemaRevision) {
    model = await reload();
    record = await model.data.getRecord({ modelId: model.modelId, recordId }, { signal });
  }
  if (record.schemaRevision !== model.snapshot.schemaRevision)
    throw new FormworkError("SCHEMA_CONFLICT", "模型与记录版本不一致，请重新加载");
  return { model, record };
}
/** 为一个编辑目标持有独立草稿；提交失败保留原值和输入。 */
export function createRecordEditor(
  options: Accessor<
    ModelOptions & { mode: "create" | "edit"; recordId?: string; operation?: RecordOperation }
  >,
) {
  const runtime = useRuntime();
  const [model, { refetch: reloadModel }] = createModelResource(() => {
    const value = options();
    return {
      ...value,
      modelId: value.modelId ?? value.operation?.modelId,
      router: value.router ?? value.operation?.model.router,
    };
  });
  let read: AbortController | undefined;
  let write: AbortController | undefined;
  const [saving, setSaving] = createSignal(false);
  const [failure, setFailure] = createSignal<unknown>();
  const [loaded] = createResource(
    () => {
      const context = model();
      return context && { context, ...options() };
    },
    async ({ context, mode, recordId, operation, ...local }) => {
      read?.abort();
      read = new AbortController();
      const signal = operation ? AbortSignal.any([read.signal, operation.signal]) : read.signal;
      if (!context.snapshot.capabilities.actions[mode === "create" ? "create" : "update"])
        throw new FormworkError("FORBIDDEN", "不允许写入此模型");
      if (mode === "create") return { model: context, record: undefined, mode };
      const id = recordId ?? operation?.recordId;
      if (!id) throw new FormworkError("INVALID_INPUT", "编辑操作缺少 recordId");
      return {
        ...(await readConsistentRecord(context, id, signal, () =>
          loadModel(
            runtime,
            { ...local, modelId: context.modelId, router: context.router },
            signal,
          ),
        )),
        mode,
      };
    },
  );
  const session = createMemo(() => {
    const loadedValue = loaded();
    if (!loadedValue) return undefined;
    return untrack(() => {
      const { model: context, record, mode } = loadedValue;
      const scope = context.createScope({
        schema: writable(context, mode),
        value: record?.data,
        defaults: mode === "create",
      });
      const [baseline, setBaseline] = createSignal(scope.value());
      const dirty = () => !equal(baseline(), scope.value());
      const operation = options().operation;
      const release = operation ? operation.guard(dirty) : runtime.guard(dirty);
      onCleanup(release);
      return { model: context, record, scope, mode, dirty, setBaseline };
    });
  });
  onCleanup(() => {
    read?.abort();
    write?.abort();
  });
  return {
    session,
    loading: () => model.loading || loaded.loading,
    error: () => failure() ?? model.error ?? loaded.error,
    saving,
    dirty: () => session()?.dirty() ?? false,
    async reload() {
      if (
        session()?.dirty() &&
        !(await runtime.confirm("重新加载将丢弃未保存的修改，确定继续吗？"))
      )
        return;
      setFailure(undefined);
      try {
        await reloadModel();
      } catch (error) {
        setFailure(error);
      }
    },
    async submit(): Promise<RecordSnapshot | undefined> {
      const current = session();
      if (!current || saving()) return;
      setSaving(true);
      setFailure(undefined);
      write = new AbortController();
      const operation = options().operation;
      const signal = operation ? AbortSignal.any([operation.signal, write.signal]) : write.signal;
      try {
        if ((await current.scope.validate()).status !== "valid") return;
        checkAbort(signal);
        const value = current.scope.value() as RecordValue;
        const { model: context, record } = current;
        const saved = record
          ? await runtime.data.update(
              {
                modelId: context.modelId,
                recordId: record.id,
                changes: recordChanges(context, record.data, value),
                ifSchemaRevision: context.snapshot.schemaRevision,
                ifRecordRevision: record.revision,
              },
              { signal },
            )
          : await runtime.data.create(
              {
                modelId: context.modelId,
                data: projection(context, value, "create"),
                ifSchemaRevision: context.snapshot.schemaRevision,
              },
              { signal },
            );
        checkAbort(signal);
        // 独立 Editor 保存后也更新 CAS 基线，允许继续编辑。
        current.record = saved;
        current.scope.reset(saved.data);
        current.setBaseline(current.scope.value());
        operation?.complete(saved);
        return saved;
      } catch (error) {
        if (!signal.aborted) setFailure(error);
        return undefined;
      } finally {
        if (!signal.aborted) setSaving(false);
      }
    },
  };
}
/** 向应用编辑器提供草稿、提交和错误状态。 */
export type RecordEditorController = ReturnType<typeof createRecordEditor>;
