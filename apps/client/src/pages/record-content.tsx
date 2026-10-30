import { createResource, createSignal, Show } from "solid-js";
import type { Component } from "solid-js";
import { FormworkError } from "formwork";
import type { PageContext, ValidationIssue } from "formwork";
import { DetailItem, FormItem } from "../ui/field-container";
import { Icon } from "../ui/icons";

/** 装载完整记录内容并以一次提交完成当前 Window。 */
export const RecordEditor: Component<PageContext> = (ctx) => {
  const [ready, { refetch }] = createResource(async () => {
    if (ctx.params.id) ctx.scope.reset(await ctx.fn.loadRecord());
    return true;
  });
  const [saving, setSaving] = createSignal(false);
  const [failure, setFailure] = createSignal("");
  const [issues, setIssues] = createSignal<readonly ValidationIssue[]>([]);
  let form: HTMLDivElement | undefined;
  const Render = ctx.Render;
  const reload = async () => {
    try {
      await refetch();
      if (!ctx.signal.aborted && !ready.error)
        (
          form?.querySelector<HTMLElement>(".control") ?? form?.querySelector<HTMLElement>("h1")
        )?.focus();
    } catch {
      // Resource 保留加载错误，由当前窗口的重试提示呈现。
    }
  };
  const submit = async () => {
    if (saving() || ready.error || !ready()) return;
    setSaving(true);
    setFailure("");
    setIssues([]);
    try {
      if ((await ctx.scope.validate()).status !== "valid") {
        form
          ?.querySelector<HTMLElement>(
            '[aria-invalid="true"], .form-item:has(.field-error) .control',
          )
          ?.focus();
        return;
      }
      const saved = await ctx.fn.saveRecord(ctx.scope.value());
      if (!ctx.signal.aborted) ctx.complete(saved);
    } catch (error) {
      if (!ctx.signal.aborted) {
        setFailure(error instanceof Error ? error.message : String(error));
        if (error instanceof FormworkError) setIssues(error.issues);
      }
    } finally {
      if (!ctx.signal.aborted) setSaving(false);
    }
  };
  return (
    <div
      class="record-form"
      ref={(element) => {
        form = element;
      }}
    >
      <div class="record-heading">
        <h1 tabindex="-1">
          {ctx.params.id ? "编辑" : "新建"}
          {ctx.schema.title}
        </h1>
      </div>
      <Show when={ready.error}>
        <p role="alert">
          {String(ready.error)}{" "}
          <button class="text-button" onClick={reload}>
            重试加载
          </button>
        </p>
      </Show>
      <Show
        when={!ready.error && ready()}
        fallback={
          <Show when={ready.loading}>
            <p role="status">正在加载记录…</p>
          </Show>
        }
      >
        <div class="record-fields">
          <Render fieldContainer={FormItem} />
        </div>
        <Show when={failure()}>
          <p role="alert">{failure()}</p>
        </Show>
        <Show when={issues().length}>
          <ul class="server-issues">
            {issues().map((issue) => (
              <li role="alert">
                <code>{issue.path || "/"}</code> · {issue.message}
              </li>
            ))}
          </ul>
        </Show>
        <div class="record-actions">
          <span>标记 * 的字段为必填项</span>
          <button class="button" disabled={saving()} onClick={submit}>
            <Icon name="check" />
            {saving() ? "正在保存…" : "保存"}
          </button>
        </div>
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
  let detail: HTMLDivElement | undefined;
  const reload = async () => {
    try {
      await refetch();
      if (!ctx.signal.aborted && !ready.error) detail?.querySelector<HTMLElement>("h1")?.focus();
    } catch {
      // Resource 保留加载错误，由当前窗口的重试提示呈现。
    }
  };
  return (
    <div
      class="record-detail"
      ref={(element) => {
        detail = element;
      }}
    >
      <div class="record-heading">
        <h1 tabindex="-1">{ctx.schema.title}详情</h1>
      </div>
      <Show when={ready.error}>
        <p role="alert">
          {String(ready.error)}{" "}
          <button class="text-button" onClick={reload}>
            重试加载
          </button>
        </p>
      </Show>
      <Show
        when={!ready.error && ready()}
        fallback={
          <Show when={ready.loading}>
            <p role="status">正在加载记录…</p>
          </Show>
        }
      >
        <div class="detail-fields">
          <Render scope={value} view={ctx.schema.views?.detail} fieldContainer={DetailItem} />
        </div>
      </Show>
    </div>
  );
};
