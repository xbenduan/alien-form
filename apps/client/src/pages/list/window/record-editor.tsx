import { createSignal, Show } from "solid-js";
import type { Component } from "solid-js";
import { FormworkError } from "formwork";
import type { WindowContext, ValidationIssue } from "formwork";
import { RecordForm } from "../../../components/records/record-form";
import { RecordRelations } from "../../../formwork/data/record-relations";
import { Icon } from "../../../formwork/shell/icons";
import { RecordHeading } from "../../../formwork/shell/page-window";

/** 编辑 Window 已准备的独立草稿，保存成功后向调用方回传记录。 */
export const RecordEditor: Component<WindowContext> = (ctx) => {
  const [saving, setSaving] = createSignal(false);
  const [failure, setFailure] = createSignal("");
  const [issues, setIssues] = createSignal<readonly ValidationIssue[]>([]);
  let form: HTMLDivElement | undefined;
  const original = ctx.params.id ? ctx.scope.value() : undefined;
  const submit = async () => {
    if (saving()) return;
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
      const saved = await ctx.fn.saveRecord(ctx.scope.value(), original);
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
      <RecordHeading
        title={`${ctx.params.id ? "编辑" : "新建"}${ctx.schema.title}`}
        section="填写信息"
      />
      <div class="record-fields">
        <RecordRelations ctx={ctx}>
          <RecordForm
            model={ctx.model}
            RenderItem={ctx.RenderItem}
            scope={ctx.scope}
            editing={!!ctx.params.id}
          />
        </RecordRelations>
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
    </div>
  );
};
