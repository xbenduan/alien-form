import { createMemo, createResource, For, onCleanup, Show } from "solid-js";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { FormworkError } from "../model/errors";
import { component, createModelResource, loadModel, useRuntime } from "../core/context";
import { createRecordEditor, readConsistentRecord } from "../core/record-editor";
import type { RecordEditorController } from "../core/record-editor";
import type { ModelContext, ModelOptions, RecordOperation } from "../core/types";
import type { ValueScope, RenderItemProps } from "../runtime/types";
import { Feedback } from "../core/formwork";

/** 指定要展示的模型、字段 scope 和场景。 */
export type FieldsProps = {
  model: ModelContext;
  scope: ValueScope;
  scene?: "form" | "detail";
  disabled?: boolean;
};
/** 渲染一个具名字段，使用当前模型已经解析的场景映射。 */
export const Field: Component<{ model: ModelContext } & RenderItemProps> = (props) => {
  const RenderItem = props.model.RenderItem;
  return <RenderItem {...props} />;
};
/** 遍历授权可见的根字段；容器和字段真实 DOM 均由 app 组件提供。 */
export const Fields: Component<FieldsProps> = (props) => {
  const runtime = useRuntime();
  const RenderItem = props.model.RenderItem;
  const scene = () => props.scene ?? "form";
  return (
    <For
      each={props.model.model.fields.filter(
        (field) =>
          (field.capabilities?.read !== false ||
            (scene() === "form" && !props.scope.field(field.path).readOnly())) &&
          field.schema.ui?.[scene()] !== false,
      )}
    >
      {(field) => {
        const binding = props.scope.field(field.path);
        return (
          <Dynamic
            component={component(runtime, runtime.app.ui.fieldContainer)}
            path={field.path}
            field={field}
            title={field.schema.title ?? field.path.slice(1)}
            schema={field.valueSchema}
            scene={scene()}
            required={!!field.schema.required}
            errors={binding.errors()}
            binding={binding}
            disabled={props.disabled}
            readOnly={scene() === "detail"}
          >
            <RenderItem
              field={field}
              scene={scene()}
              binding={binding}
              disabled={props.disabled}
              readOnly={scene() === "detail"}
            />
          </Dynamic>
        );
      }}
    </For>
  );
};
/** 允许详情独立使用，操作出口会自动传入 operation。 */
export type DetailProps = ModelOptions & { recordId?: string; operation?: RecordOperation };
/** 加载完整记录并提供只读字段，slot 挂载时才发起读取。 */
export const Detail: Component<DetailProps> = (props) => {
  const runtime = useRuntime();
  const [model] = createModelResource(() => ({
    ...props,
    modelId: props.modelId ?? props.operation?.modelId,
    router: props.router ?? props.operation?.model.router,
  }));
  let pending: AbortController | undefined;
  onCleanup(() => pending?.abort());
  const [loaded, { refetch }] = createResource(
    () => {
      const context = model();
      return context && { context, recordId: props.recordId ?? props.operation?.recordId };
    },
    async ({ context, recordId }) => {
      if (!recordId) throw new FormworkError("INVALID_INPUT", "详情缺少 recordId");
      pending?.abort();
      pending = new AbortController();
      const signal = props.operation
        ? AbortSignal.any([pending.signal, props.operation.signal])
        : pending.signal;
      return readConsistentRecord(context, recordId, signal, () =>
        loadModel(runtime, { ...props, modelId: context.modelId, router: context.router }, signal),
      );
    },
  );
  const state = createMemo(() => {
    const value = loaded();
    return (
      value && {
        ...value,
        scope: value.model.createScope({
          value: value.record.data,
          readOnly: true,
          defaults: false,
        }),
      }
    );
  });
  return (
    <Show
      when={!model.error && !loaded.error}
      fallback={
        <Feedback kind="error" error={model.error ?? loaded.error} retry={() => refetch()} />
      }
    >
      <Show when={state()} keyed fallback={<Feedback kind="loading" />}>
        {(value) => (
          <Dynamic
            component={component(runtime, runtime.app.ui.detail?.layout)}
            model={value.model}
            record={value.record}
            operation={props.operation}
            reload={() => refetch()}
          >
            <Fields model={value.model} scope={value.scope} scene="detail" />
          </Dynamic>
        )}
      </Show>
    </Show>
  );
};
/** 允许直接指定新建/编辑目标，或借用 app 创建的 controller。 */
export type EditorProps = ModelOptions & {
  recordId?: string;
  mode?: "create" | "edit";
  operation?: RecordOperation;
  controller?: RecordEditorController;
};
/** 将独立草稿及保存行为交给 app 编辑布局，保存失败时保留输入。 */
export const Editor: Component<EditorProps> = (props) => {
  const runtime = useRuntime();
  const controller =
    props.controller ??
    createRecordEditor(() => ({
      ...props,
      mode: props.mode ?? (props.operation?.mode === "create" ? "create" : "edit"),
    }));
  return (
    <>
      <Show when={controller.error()}>
        {(error) => <Feedback kind="error" error={error()} retry={controller.reload} />}
      </Show>
      <Show
        when={controller.session()}
        keyed
        fallback={
          <Show when={controller.loading()}>
            <Feedback kind="loading" />
          </Show>
        }
      >
        {(session) => (
          <Dynamic
            component={component(runtime, runtime.app.ui.editor?.layout)}
            controller={controller}
            operation={props.operation}
          >
            <Fields model={session.model} scope={session.scope} disabled={controller.saving()} />
          </Dynamic>
        )}
      </Show>
    </>
  );
};
