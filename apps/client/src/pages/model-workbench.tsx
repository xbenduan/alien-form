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

/** 编辑完整模型原文，并用实际路由创建带 revision 的页面预览。 */
export const ModelWorkbench: Component<ActionContext> = (ctx) => {
  const [directory, { refetch: refreshDirectory }] = createResource(() =>
    ctx.models.list({ signal: ctx.signal }),
  );
  const [selected, { refetch: refreshSelected }] = createResource(
    () => ctx.params.domain,
    (id) => ctx.models.read(id, { signal: ctx.signal }),
  );
  const entries = () => (directory.error ? [] : (directory() ?? []));
  const snapshot = () => (selected.error ? undefined : selected());
  const initialQuery = new URLSearchParams(location.search);
  const [router, setRouter] = createSignal(initialQuery.get("router") ?? "list");
  const [recordId, setRecordId] = createSignal(initialQuery.get("id") ?? "");
  const [draft, setDraft] = createSignal("");
  const [dirty, setDirty] = createSignal(false);
  const [revision, setRevision] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
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
        url: `${url}?formworkRevision=${encodeURIComponent(snapshot()!.revision)}`,
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
      const snapshot = await localModels.read(ctx.params.domain!, { signal: ctx.signal });
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
    <div>
      <header class="page-header">
        <div>
          <div class="eyebrow">FULL MODEL SOURCE / {modelSourceName.toUpperCase()}</div>
          <h1>模型工作台</h1>
        </div>
        <button class="button secondary" onClick={() => ctx.navigate("home")}>
          首页
        </button>
      </header>
      <Show when={directory.error || selected.error}>
        <p role="alert">
          {errorPayload(directory.error ?? selected.error).code}:{" "}
          {errorPayload(directory.error ?? selected.error).message}
        </p>
      </Show>
      <div class="workbench">
        <nav>
          <For each={entries()}>
            {(entry) => (
              <button
                class="model-card"
                classList={{ selected: entry.id === snapshot()?.id }}
                onClick={() => ctx.navigate("models", { domain: entry.id })}
              >
                <strong>{entry.title}</strong>
                <p class="muted">
                  {entry.id} · {entry.writable ? "可编辑" : "只读"}
                </p>
              </button>
            )}
          </For>
        </nav>
        <Show
          when={snapshot()}
          fallback={<div class="panel muted">选择一个模型查看完整源和预览。</div>}
        >
          <div>
            <section class="panel">
              <div class="page-header">
                <div>
                  <h2>{snapshot()?.title}</h2>
                  <code class="muted">{snapshot()?.revision.slice(0, 16)}</code>
                </div>
                <div class="actions">
                  <button
                    class="button secondary"
                    disabled={busy()}
                    onClick={() => {
                      setDirty(false);
                      void refreshSelected();
                    }}
                  >
                    重新载入
                  </button>
                  <Show when={modelSourceName === "local"}>
                    <button class="button secondary" disabled={busy()} onClick={upload}>
                      上传到远端
                    </button>
                  </Show>
                  <button
                    class="button"
                    disabled={busy() || !snapshot()?.writable || !dirty()}
                    onClick={save}
                  >
                    保存模型
                  </button>
                </div>
              </div>
              <textarea
                aria-label="完整模型 JSON"
                class="control model-json"
                value={draft()}
                readOnly={!snapshot()?.writable}
                onInput={(event) => {
                  setDraft(event.currentTarget.value);
                  setDirty(true);
                }}
              />
              <Show when={message()}>
                <p role="status">{message()}</p>
              </Show>
            </section>
            <section class="panel">
              <div class="page-header">
                <h2>实际页面预览</h2>
                <div class="actions">
                  <select
                    class="control"
                    aria-label="预览页面"
                    value={router()}
                    onChange={(event) => setRouter(event.currentTarget.value)}
                  >
                    <For
                      each={routes.filter(
                        (route) => route.router !== "models" && route.router !== "home",
                      )}
                    >
                      {(route) => <option value={route.router}>{route.router}</option>}
                    </For>
                  </select>
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
              </div>
              <Show when={preview().url} keyed fallback={<p role="alert">{preview().error}</p>}>
                {(url) => <iframe class="preview-frame" title="模型实际预览" src={url} />}
              </Show>
            </section>
          </div>
        </Show>
      </div>
    </div>
  );
};
