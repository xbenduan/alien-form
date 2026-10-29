import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js";
import type { Component } from "solid-js";
import type { ActionContext, Diagnostic } from "formwork";
import { FormworkError } from "formwork";
import { errorPayload, modelIdPattern } from "formwork/model";
import { sessionUser } from "../models";
import { Icon } from "../ui/icons";
import { McpGuide } from "../ui/mcp-guide";
import { SelectControl } from "../ui/select";

/** 编辑数据库完整 definition，保存可诊断草稿，并手动发布已审阅 revision。 */
export const ModelWorkbench: Component<ActionContext> = (ctx) => {
  const [directory, { refetch: refreshDirectory }] = createResource(() =>
    ctx.api.models.list({ signal: ctx.signal }),
  );
  const entries = () => (directory.error ? [] : (directory() ?? []));
  const [creating, setCreating] = createSignal<string>();
  const modelId = () => creating() ?? ctx.params.domain ?? entries()[0]?.id;
  const [selected, { refetch: refreshSelected, mutate }] = createResource(
    () => (creating() ? undefined : modelId()),
    (id) => ctx.api.models.read(id, { signal: ctx.signal }),
  );
  const snapshot = () => (selected.error || creating() ? undefined : selected());
  const [versions, { refetch: refreshVersions }] = createResource(
    () => snapshot()?.id,
    (id) => ctx.api.models.versions(id, { signal: ctx.signal }),
  );
  const [versionNumber, setVersionNumber] = createSignal<number>();
  const [draft, setDraft] = createSignal("");
  const [dirty, setDirty] = createSignal(false);
  const [revision, setRevision] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [issues, setIssues] = createSignal<readonly Diagnostic[]>([]);
  const [router, setRouter] = createSignal("list");
  const [recordId, setRecordId] = createSignal("");
  const [editorScroll, setEditorScroll] = createSignal(0);
  const lines = createMemo(() =>
    Array.from({ length: draft().split("\n").length }, (_, index) => index + 1),
  );
  createEffect(() => {
    const current = snapshot();
    if (current && !dirty()) {
      setDraft(JSON.stringify(current.definition, null, 2));
      setRevision(current.revision);
    }
  });
  const preview = createMemo(() => {
    const current = snapshot();
    if (!current) return { url: "", error: "请先保存草稿。" };
    if (dirty()) return { url: "", error: "先保存草稿，再预览审阅结果。" };
    if (current.diagnostics.errors.length)
      return { url: "", error: "草稿有校验错误，修复后才能预览。" };
    if (["edit", "detail"].includes(router()) && !recordId())
      return { url: "", error: "此页面预览需要记录 ID。" };
    return {
      url: `/model-preview/${current.id}?${new URLSearchParams({ router: router(), revision: current.revision, ...(recordId() ? { id: recordId() } : {}) })}`,
      error: "",
    };
  });
  const reportFailure = (error: unknown) => {
    if (ctx.signal.aborted) return;
    const payload = errorPayload(error);
    setMessage(
      `${payload.code}: ${payload.message}${error instanceof FormworkError && error.currentRevision ? `；当前 revision ${error.currentRevision}。编辑文本已保留，请重新载入后合并。` : ""}`,
    );
    setIssues(payload.issues ?? []);
  };
  const run = async (action: () => Promise<void>) => {
    if (busy()) return;
    setBusy(true);
    setMessage("");
    setIssues([]);
    try {
      await action();
    } catch (error) {
      reportFailure(error);
    } finally {
      if (!ctx.signal.aborted) setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      const id = modelId();
      if (!id) return;
      const result = await ctx.api.models.saveDraft(id, JSON.parse(draft()), {
        ifRevision: revision(),
        signal: ctx.signal,
      });
      if (ctx.signal.aborted) return;
      setDirty(false);
      setRevision(result.revision);
      setDraft(JSON.stringify(result.definition, null, 2));
      mutate(result);
      await refreshDirectory();
      if (creating()) ctx.navigate("models", { domain: id });
      else
        setMessage(
          `已保存草稿；${result.diagnostics.errors.length ? `有 ${result.diagnostics.errors.length} 项错误` : "校验通过"}，尚未发布。`,
        );
    });
  const publish = () =>
    run(async () => {
      const current = snapshot();
      if (!current || dirty() || current.stage !== "draft" || !current.canPublish) return;
      const result = await ctx.api.models.publish(current.id, current.revision, {
        signal: ctx.signal,
      });
      if (ctx.signal.aborted) return;
      await refreshSelected();
      await refreshDirectory();
      await refreshVersions();
      setMessage(`已手动发布版本 ${result.version}；普通页面刷新后使用新 schema。`);
    });
  return (
    <div class="workbench-page">
      <header class="page-header">
        <div class="page-title">
          <h1>模型工作台</h1>
          <span class="eyebrow">数据库草稿</span>
        </div>
        <div class="actions">
          <button
            class="button secondary"
            disabled={busy() || !snapshot()}
            onClick={() =>
              run(async () => {
                setDirty(false);
                await refreshSelected();
                setMessage("已重新载入最新管理状态。");
              })
            }
          >
            <Icon name="refresh" />
            重新载入
          </button>
          <button
            class="button"
            disabled={busy() || !dirty() || (!creating() && !snapshot()?.canManage)}
            onClick={save}
          >
            <Icon name="check" />
            保存草稿
          </button>
          <button
            class="button"
            disabled={
              busy() ||
              dirty() ||
              !snapshot()?.canPublish ||
              snapshot()?.stage !== "draft" ||
              !!snapshot()?.diagnostics.errors.length
            }
            onClick={publish}
          >
            手动发布
          </button>
        </div>
      </header>
      <McpGuide />
      <Show when={directory.error || selected.error}>
        <p role="alert">{errorPayload(directory.error ?? selected.error).message}</p>
      </Show>
      <Show when={message()}>
        <p class="workbench-message" role="status">
          {message()}
        </p>
      </Show>
      <div class="workbench">
        <nav aria-label="选择模型">
          <Show when={sessionUser()?.canCreateModel}>
            <form
              class="new-model-form"
              onSubmit={(event) => {
                event.preventDefault();
                const id = String(new FormData(event.currentTarget).get("modelId"));
                if (!modelIdPattern.test(id) || id.startsWith("system-")) {
                  setMessage("模型 ID 必须是单段小写标识，不能使用 system- 前缀。");
                  return;
                }
                setCreating(id);
                setRevision(null);
                setDirty(true);
                setMessage("新模型尚未保存。");
                setDraft(
                  JSON.stringify(
                    {
                      document: {
                        id,
                        title: id,
                        data: { type: "object", properties: {}, additionalProperties: false },
                      },
                      backend: {
                        storage: { table: `biz_${id.replaceAll("-", "_")}`, bindings: [] },
                        relations: [],
                        permissions: { grants: [], privateFields: [] },
                        behavior: { rules: [], commands: {}, events: {} },
                      },
                    },
                    null,
                    2,
                  ),
                );
              }}
            >
              <input
                class="control"
                name="modelId"
                aria-label="新模型 ID"
                placeholder="新模型 ID"
                required
              />
              <button class="button secondary" disabled={busy()}>
                新建模型
              </button>
            </form>
          </Show>
          <For each={entries()}>
            {(entry) => (
              <button
                class="model-card"
                classList={{ selected: entry.id === snapshot()?.id }}
                aria-current={entry.id === snapshot()?.id ? "true" : undefined}
                onClick={() => ctx.navigate("models", { domain: entry.id })}
              >
                <Icon name="model" />
                <strong>{entry.title}</strong>
                <code>{entry.id}</code>
                <span class="muted">
                  {entry.stage === "draft" ? "共享草稿" : "已发布"} ·{" "}
                  {entry.publishedVersion === null ? "未发布" : `v${entry.publishedVersion}`}
                </span>
              </button>
            )}
          </For>
          <button
            class="text-button"
            disabled={directory.loading}
            onClick={() => refreshDirectory()}
          >
            刷新目录
          </button>
        </nav>
        <Show
          when={snapshot() || creating()}
          fallback={
            <div class="panel workbench-empty">
              <p>{selected.loading || directory.loading ? "正在加载模型…" : "选择或新建模型。"}</p>
            </div>
          }
        >
          <div class="workbench-panels">
            <section class="panel source-panel">
              <div class="editor-heading">
                <h2>
                  <Icon name="code" />
                  完整 definition
                </h2>
                <span class="draft-state" classList={{ dirty: dirty() }}>
                  {dirty() ? "未保存" : snapshot()?.stage === "draft" ? "已保存草稿" : "已发布"}
                </span>
              </div>
              <div class="editor-toolbar">
                <code>
                  {modelId()} · {revision()?.slice(0, 8) ?? "新建"}
                </code>
                <span>JSON</span>
              </div>
              <div class="code-editor">
                <div class="code-gutter" aria-hidden="true">
                  <div style={{ transform: `translateY(-${editorScroll()}px)` }}>
                    <For each={lines()}>{(line) => <div>{line}</div>}</For>
                  </div>
                </div>
                <textarea
                  aria-label="完整 definition JSON"
                  class="control model-json"
                  spellcheck={false}
                  wrap="off"
                  value={draft()}
                  disabled={busy()}
                  onScroll={(event) => setEditorScroll(event.currentTarget.scrollTop)}
                  onInput={(event) => {
                    setDraft(event.currentTarget.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div class="editor-footer">
                <span>{lines().length} 行</span>
                <span>UTF-8</span>
              </div>
              <section class="diagnostics" aria-label="草稿诊断">
                <h2>草稿诊断</h2>
                <For each={[...(snapshot()?.diagnostics.errors ?? []), ...issues()]}>
                  {(issue) => (
                    <p role="alert">
                      <code>{issue.path || "/"}</code> · {issue.code} · {issue.message}
                    </p>
                  )}
                </For>
                <Show when={!snapshot()?.diagnostics.errors.length && !issues().length}>
                  <p class="muted">{dirty() ? "保存后返回最新诊断。" : "没有可确定错误。"}</p>
                </Show>
                <For each={snapshot()?.diagnostics.runtimeChecks ?? []}>
                  {(issue) => (
                    <p class="muted">
                      <code>{issue.path}</code> · {issue.message}
                    </p>
                  )}
                </For>
              </section>
              <section class="version-directory" aria-label="发布版本">
                <h2>发布版本 · 只读</h2>
                <Show when={versions.error}>
                  <p role="alert">{errorPayload(versions.error).message}</p>
                </Show>
                <For each={versions.error ? [] : (versions() ?? [])}>
                  {(version) => (
                    <button
                      class="text-button"
                      onClick={() =>
                        setVersionNumber(
                          versionNumber() === version.version ? undefined : version.version,
                        )
                      }
                    >
                      v{version.version} · {version.revision.slice(0, 8)}
                    </button>
                  )}
                </For>
                <Show when={versionNumber()}>
                  {(number) => (
                    <pre class="version-json">
                      {JSON.stringify(
                        (versions.error ? [] : (versions() ?? [])).find(
                          (version) => version.version === number(),
                        )?.definition,
                        null,
                        2,
                      )}
                    </pre>
                  )}
                </Show>
              </section>
            </section>
            <section class="panel preview-panel">
              <div class="editor-heading">
                <h2>
                  <Icon name="preview" />
                  管理预览
                </h2>
                <span class="muted">业务写入禁用</span>
              </div>
              <div class="preview-toolbar">
                <SelectControl
                  class="preview-select"
                  label="预览页面"
                  value={router()}
                  onChange={(value) => {
                    if (value) setRouter(value);
                  }}
                  options={[
                    ["list", "记录列表"],
                    ["add", "新建记录"],
                    ["edit", "编辑记录"],
                    ["detail", "记录详情"],
                  ].map(([value, label]) => ({ value, label }))}
                />
                <Show when={router() === "edit" || router() === "detail"}>
                  <input
                    class="control"
                    aria-label="预览记录 ID"
                    placeholder="记录 ID"
                    value={recordId()}
                    onInput={(event) => setRecordId(event.currentTarget.value)}
                  />
                </Show>
              </div>
              <Show
                when={preview().url}
                keyed
                fallback={
                  <div class="preview-error">
                    <p>{preview().error}</p>
                  </div>
                }
              >
                {(url) => <iframe class="preview-frame" title="模型管理预览" src={url} />}
              </Show>
            </section>
          </div>
        </Show>
      </div>
    </div>
  );
};
