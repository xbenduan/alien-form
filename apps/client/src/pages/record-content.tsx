import { createResource, createSignal, Show } from "solid-js";
import type { Component } from "solid-js";
import type { PageContext } from "formwork";
import { DetailItem, FormItem } from "../ui/field-container";

/** 装载完整记录内容并以一次提交完成当前 Window。 */
export const RecordEditor: Component<PageContext> = (ctx) => {
  const [ready, { refetch }] = createResource(async () => {
    if (ctx.params.id) ctx.scope.reset(await ctx.fn.loadRecord());
    return true;
  });
  const [saving, setSaving] = createSignal(false);
  const [failure, setFailure] = createSignal("");
  const Render = ctx.Render;
  const submit = async () => {
    if (saving() || !ready()) return;
    setSaving(true);
    setFailure("");
    try {
      if ((await ctx.scope.validate()).status !== "valid") return;
      const saved = await ctx.fn.saveRecord(ctx.scope.value());
      if (!ctx.signal.aborted) ctx.complete(saved);
    } catch (error) {
      if (!ctx.signal.aborted) setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      if (!ctx.signal.aborted) setSaving(false);
    }
  };
  return (
    <div class="record-form">
      <h1>
        {ctx.params.id ? "编辑" : "新建"}
        {ctx.model.title}
      </h1>
      <Show when={ready.error}>
        <p role="alert">
          {String(ready.error)}{" "}
          <button class="text-button" onClick={() => refetch()}>
            重试加载
          </button>
        </p>
      </Show>
      <Show when={ready()} fallback={<p role="status">正在加载记录…</p>}>
        <div class="panel">
          <Render fieldContainer={FormItem} />
        </div>
        <Show when={failure()}>
          <p role="alert">{failure()}</p>
        </Show>
        <button class="button" disabled={saving()} onClick={submit}>
          {saving() ? "正在保存…" : "保存"}
        </button>
      </Show>
    </div>
  );
};
/** 装载完整只读记录，由 Drawer 承载同一 Render。 */
export const RecordDetail: Component<PageContext> = (ctx) => {
  const value = ctx.createScope({ readOnly: true, defaults: false });
  const [ready, { refetch }] = createResource(async () => {
    value.reset(await ctx.fn.loadRecord());
    return true;
  });
  const Render = ctx.Render;
  return (
    <div>
      <h1>{ctx.model.title}详情</h1>
      <Show when={ready.error}>
        <p role="alert">
          {String(ready.error)}{" "}
          <button class="text-button" onClick={() => refetch()}>
            重试加载
          </button>
        </p>
      </Show>
      <Show when={ready()} fallback={<p role="status">正在加载记录…</p>}>
        <div class="panel">
          <Render scope={value} view={ctx.model.views?.detail} fieldContainer={DetailItem} />
        </div>
      </Show>
    </div>
  );
};
