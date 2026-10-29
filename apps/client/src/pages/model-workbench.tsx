import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import type { Component } from "solid-js";
import type { ActionContext, ModelDocument } from "formwork";
import { FormworkError } from "formwork";
import { errorPayload, routePath } from "formwork/model";
import { routes } from "virtual:formwork/capabilities";
import { localModels, modelSourceName, remoteModels } from "../models";
import { Icon } from "../ui/icons";
import { McpGuide } from "../ui/mcp-guide";
import { SelectControl } from "../ui/select";

/** 编辑完整模型原文，并用实际路由创建带 revision 的页面预览。 */
export const ModelWorkbench: Component<ActionContext> = (ctx) => {
  const [directory, { refetch: refreshDirectory }] = createResource(() =>
    ctx.models.list({ signal: ctx.signal }),
  );
  const entries = () => (directory.error ? [] : (directory() ?? []));
  const modelId = () => ctx.params.domain ?? entries()[0]?.id;
  const [selected, { refetch: refreshSelected }] = createResource(modelId, (id) =>
    ctx.models.read(id, { signal: ctx.signal }),
  );
  const snapshot = () => (selected.error ? undefined : selected());
  const initialQuery = new URLSearchParams(location.search);
  const [router, setRouter] = createSignal(initialQuery.get("router") ?? "list");
  const [recordId, setRecordId] = createSignal(initialQuery.get("id") ?? "");
  const [draft, setDraft] = createSignal("");
  const [dirty, setDirty] = createSignal(false);
  const [revision, setRevision] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [editorScroll, setEditorScroll] = createSignal(0);
  const lineNumbers = createMemo(() =>
    Array.from({ length: draft().split("\n").length }, (_, index) => index + 1),
  );
  const routeLabel = (router: string) =>
    ({ list: "记录列表", add: "新建记录", edit: "编辑记录", detail: "记录详情" })[router] ?? router;
  createEffect(() => {
    const current = snapshot();
    if (current && !dirty()) {
      setDraft(JSON.stringify(current.document, null, 2));
      setRevision(current.revision);
    }
  });
  const onUpdate = () => {
    if (dirty()) setMessage("模型源已更新；当前草稿保留，保存将检查原 revision。");
    void Promise.allSettled([refreshDirectory(), refreshSelected()]);
  };
  window.addEventListener("formwork:model-update", onUpdate);
  onCleanup(() => window.removeEventListener("formwork:model-update", onUpdate));
  const preview = createMemo(() => {
    if (!snapshot()) return { url: "", error: "" };
    try {
      const url = routePath(routes, router(), {
        domain: snapshot()!.id,
        ...(recordId() ? { id: recordId() } : {}),
      });
      return {
        url: `${url}?formworkRevision=${encodeURIComponent(snapshot()!.revision)}&embedded=1`,
        error: "",
      };
    } catch (error) {
      return { url: "", error: error instanceof Error ? error.message : String(error) };
    }
  });
  const save = async () => {
    if (busy() || !snapshot()) return;
    setBusy(true);
    setMessage("");
    try {
      const document = JSON.parse(draft()) as ModelDocument;
      if (document.id !== snapshot()!.id)
        throw new FormworkError("INVALID_MODEL", "模型 id 不能原地修改");
      await ctx.models.write(document, { ifRevision: revision()!, signal: ctx.signal });
      if (!ctx.signal.aborted) {
        setDirty(false);
        await refreshSelected();
        await refreshDirectory();
        setMessage("已保存完整模型，预览已更新。");
      }
    } catch (error) {
      if (!ctx.signal.aborted)
        setMessage(
          error instanceof FormworkError ? `${error.code}: ${error.message}` : String(error),
        );
    } finally {
      if (!ctx.signal.aborted) setBusy(false);
    }
  };
  const upload = async () => {
    if (busy() || !snapshot()) return;
    setBusy(true);
    setMessage("");
    try {
      const snapshot = await localModels.read(modelId()!, { signal: ctx.signal });
      let remoteRevision: string | null = null;
      try {
        remoteRevision = (await remoteModels.read(snapshot.id, { signal: ctx.signal })).revision;
      } catch (error) {
        if (!(error instanceof FormworkError) || error.code !== "NOT_FOUND") throw error;
      }
      await remoteModels.write(snapshot.document, {
        ifRevision: remoteRevision,
        signal: ctx.signal,
      });
      if (!ctx.signal.aborted) setMessage("已上传到独立远端模型源，当前来源保持不变。");
    } catch (error) {
      if (!ctx.signal.aborted)
        setMessage(
          error instanceof FormworkError ? `${error.code}: ${error.message}` : String(error),
        );
    } finally {
      if (!ctx.signal.aborted) setBusy(false);
    }
  };
  return (
    <div class="workbench-page">
      <header class="page-header">
        <div class="page-title">
          <h1>模型工作台</h1>
          <span class="eyebrow">{modelSourceName.toUpperCase()}</span>
        </div>
        <div class="actions">
          <button
            class="button secondary"
            disabled={busy() || !snapshot()}
            onClick={() => {
              setDirty(false);
              void refreshSelected();
            }}
          >
            <Icon name="refresh" />
            重新载入
          </button>
          <Show when={modelSourceName === "local"}>
            <button class="button secondary" disabled={busy() || !snapshot()} onClick={upload}>
              <Icon name="upload" />
              上传到远端
            </button>
          </Show>
          <button
            class="button"
            disabled={busy() || !snapshot()?.writable || !dirty()}
            onClick={save}
          >
            <Icon name="check" />
            {busy() ? "正在处理…" : "保存模型"}
          </button>
        </div>
      </header>
      <McpGuide />
      <Show when={directory.error || selected.error}>
        <p role="alert">
          {errorPayload(directory.error ?? selected.error).code}:{" "}
          {errorPayload(directory.error ?? selected.error).message}
        </p>
      </Show>
      <div class="workbench">
        <nav aria-label="选择模型">
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
                <Show when={!entry.writable}>
                  <span class="muted">只读</span>
                </Show>
              </button>
            )}
          </For>
        </nav>
        <Show
          when={snapshot()}
          fallback={
            <div class="panel workbench-empty">
              <Icon name="model" />
              <p>
                {directory.loading || selected.loading
                  ? "正在加载模型…"
                  : "选择一个模型，开始构建界面。"}
              </p>
            </div>
          }
        >
          <div class="workbench-panels">
            <section class="panel source-panel">
              <div class="editor-heading">
                <h2>
                  <Icon name="code" />
                  模型源码
                </h2>
                <span class="draft-state" classList={{ dirty: dirty() }}>
                  <span class="status-dot" />
                  {dirty() ? "未保存" : "已同步"}
                </span>
              </div>
              <div class="editor-toolbar">
                <code>{snapshot()?.id}/model.json</code>
                <span class="editor-format">JSON</span>
              </div>
              <div class="code-editor">
                <div class="code-gutter" aria-hidden="true">
                  <div style={{ transform: `translateY(-${editorScroll()}px)` }}>
                    <For each={lineNumbers()}>{(line) => <div>{line}</div>}</For>
                  </div>
                </div>
                <textarea
                  aria-label="完整模型 JSON"
                  class="control model-json"
                  spellcheck={false}
                  wrap="off"
                  value={draft()}
                  readOnly={!snapshot()?.writable}
                  onScroll={(event) => setEditorScroll(event.currentTarget.scrollTop)}
                  onInput={(event) => {
                    setDraft(event.currentTarget.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div class="editor-footer">
                <span>{lineNumbers().length} 行</span>
                <span>UTF-8</span>
              </div>
            </section>
            <section class="panel preview-panel">
              <div class="editor-heading">
                <h2>
                  <Icon name="preview" />
                  页面预览
                </h2>
                <span class="source-pill" title={snapshot()?.revision}>
                  版本 {snapshot()?.revision.slice(0, 8)}
                </span>
              </div>
              <div class="preview-toolbar">
                <SelectControl
                  class="preview-select"
                  label="预览页面"
                  value={router()}
                  onChange={(value) => {
                    if (value) setRouter(value);
                  }}
                  options={routes
                    .filter((route) => route.router !== "models" && route.router !== "home")
                    .map((route) => ({ value: route.router, label: routeLabel(route.router) }))}
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
                <span class="preview-address">{preview().url.split("?")[0]}</span>
              </div>
              <Show
                when={preview().url}
                keyed
                fallback={
                  <div class="preview-error">
                    <p role="alert">{preview().error}</p>
                  </div>
                }
              >
                {(url) => <iframe class="preview-frame" title="模型实际预览" src={url} />}
              </Show>
            </section>
          </div>
        </Show>
      </div>
      <Show when={message()}>
        <p class="workbench-message" role="status">
          {message()}
        </p>
      </Show>
    </div>
  );
};
