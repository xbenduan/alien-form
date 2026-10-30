import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  createUniqueId,
  For,
  lazy,
  Show,
} from "solid-js";
import type { Component } from "solid-js";
import type { ActionContext, Diagnostic } from "formwork";
import { FormworkError } from "formwork";
import { errorPayload } from "formwork/model";
import { refreshModelMenu } from "../model-menu";
import { Icon } from "../ui/icons";
import { PageTopbar } from "../ui/page-topbar";
import { ResizablePanels } from "../ui/resizable-panels";
import { SelectControl } from "../ui/select";

const JsonEditor = lazy(() =>
  import("../ui/json-editor").then((module) => ({ default: module.JsonEditor })),
);

/** 编辑数据库完整 definition，保存可诊断草稿，并手动发布已审阅 revision。 */
export const ModelDetail: Component<ActionContext> = (ctx) => {
  const modelId = () => ctx.domain;
  const [selected, { refetch: refreshSelected, mutate }] = createResource(modelId, (id) =>
    ctx.api.models.read(id, { signal: ctx.signal }),
  );
  const snapshot = () => (selected.error ? undefined : selected());
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
  const [schemaOpen, setSchemaOpen] = createSignal(true);
  const [diagnosticsOpen, setDiagnosticsOpen] = createSignal(true);
  const schemaId = createUniqueId();
  const diagnosticsId = createUniqueId();
  const historical = createMemo(() =>
    versions.error ? undefined : versions()?.find((version) => version.version === versionNumber()),
  );
  const source = createMemo(() =>
    versionNumber() !== undefined
      ? historical()
        ? JSON.stringify(historical()!.definition, null, 2)
        : ""
      : draft(),
  );
  const stateLabel = () =>
    versionNumber() !== undefined
      ? `v${versionNumber()} · 只读`
      : dirty()
        ? "未保存"
        : snapshot()?.stage === "draft"
          ? "草稿"
          : snapshot()
            ? "已发布"
            : "正在加载";
  const diagnostics = createMemo(() =>
    versionNumber() !== undefined ? [] : [...(snapshot()?.diagnostics.errors ?? []), ...issues()],
  );
  const versionOptions = createMemo(() => [
    {
      value: "latest",
      label: `最新${snapshot()?.publishedVersion ? ` · v${snapshot()?.publishedVersion}` : ""}${snapshot()?.stage === "draft" ? " · 草稿" : ""}`,
    },
    ...(versions.error ? [] : (versions() ?? [])).map((version) => ({
      value: String(version.version),
      label: `v${version.version} · 已发布`,
    })),
  ]);
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
    if (versionNumber() !== undefined && !historical())
      return { url: "", error: "无法加载历史版本，请重新载入。" };
    if (versionNumber() === undefined && dirty())
      return { url: "", error: "先保存草稿，再预览审阅结果。" };
    if (versionNumber() === undefined && current.diagnostics.errors.length)
      return { url: "", error: "草稿有校验错误，修复后才能预览。" };
    if (["edit", "detail"].includes(router()) && !recordId())
      return { url: "", error: "此页面预览需要记录 ID。" };
    return {
      url: `/model-preview/${current.id}?${new URLSearchParams({
        router: router(),
        ...(versionNumber() !== undefined
          ? { version: String(versionNumber()) }
          : { revision: current.revision }),
        ...(recordId() ? { id: recordId() } : {}),
      })}`,
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
      if (!id || versionNumber() !== undefined || !snapshot()?.canManage) return;
      const result = await ctx.api.models.saveDraft(id, JSON.parse(draft()), {
        ifRevision: revision(),
        signal: ctx.signal,
      });
      if (ctx.signal.aborted) return;
      setDirty(false);
      setRevision(result.revision);
      setDraft(JSON.stringify(result.definition, null, 2));
      mutate(result);
      await refreshModelMenu();
      setMessage(
        `已保存草稿；${result.diagnostics.errors.length ? `有 ${result.diagnostics.errors.length} 项错误` : "校验通过"}，尚未发布。`,
      );
    });
  const publish = () =>
    run(async () => {
      const current = snapshot();
      if (
        !current ||
        versionNumber() !== undefined ||
        dirty() ||
        current.stage !== "draft" ||
        !current.canPublish
      )
        return;
      const result = await ctx.api.models.publish(current.id, current.revision, {
        signal: ctx.signal,
      });
      if (ctx.signal.aborted) return;
      await refreshSelected();
      await refreshModelMenu();
      await refreshVersions();
      setMessage(`已手动发布版本 ${result.version}；普通页面刷新后使用新 schema。`);
    });
  return (
    <div class="workbench-page">
      <PageTopbar
        title={
          <>
            <button class="text-button back-to-models" onClick={() => ctx.navigate("models")}>
              模型列表
            </button>
            <Icon name="chevron" />
            <h1>{historical()?.definition.document.title || snapshot()?.title || modelId()}</h1>
            <span
              class="draft-state"
              classList={{ dirty: versionNumber() === undefined && dirty() }}
            >
              {stateLabel()}
            </span>
          </>
        }
        actions={
          <>
            <SelectControl
              class="version-select"
              label="模型版本"
              value={versionNumber() === undefined ? "latest" : String(versionNumber())}
              options={versionOptions()}
              disabled={busy() || !snapshot()}
              onChange={(value) => {
                if (!value) return;
                setVersionNumber(value === "latest" ? undefined : Number(value));
                setMessage("");
              }}
            />
            <button
              class="button secondary"
              disabled={busy() || !snapshot()}
              onClick={() =>
                run(async () => {
                  if (versionNumber() !== undefined) {
                    await refreshVersions();
                    if (versions.error) throw versions.error;
                    setMessage(`已重新载入发布版本 ${versionNumber()}。`);
                  } else {
                    const current = await refreshSelected();
                    if (selected.error) throw selected.error;
                    if (current) {
                      setDraft(JSON.stringify(current.definition, null, 2));
                      setRevision(current.revision);
                      setDirty(false);
                    }
                    await refreshVersions();
                    setMessage("已重新载入最新管理状态。");
                  }
                })
              }
            >
              <Icon name="refresh" />
              重新载入
            </button>
            <button
              class="button secondary"
              disabled={
                busy() || versionNumber() !== undefined || !dirty() || !snapshot()?.canManage
              }
              onClick={save}
            >
              <Icon name="check" />
              保存草稿
            </button>
            <button
              class="button"
              disabled={
                busy() ||
                versionNumber() !== undefined ||
                dirty() ||
                !snapshot()?.canPublish ||
                snapshot()?.stage !== "draft" ||
                !!snapshot()?.diagnostics.errors.length
              }
              onClick={publish}
            >
              手动发布
            </button>
          </>
        }
      />
      <Show when={selected.error}>
        <p role="alert">{errorPayload(selected.error).message}</p>
      </Show>
      <Show when={versions.error}>
        <p role="alert">发布版本加载失败：{errorPayload(versions.error).message}</p>
      </Show>
      <Show when={message()}>
        <p class="workbench-message" role="status">
          {message()}
        </p>
      </Show>
      <Show
        when={snapshot()}
        fallback={
          <div class="panel workbench-empty">
            <p>{selected.loading ? "正在加载模型…" : "模型不存在或没有管理权限。"}</p>
            <button class="text-button" onClick={() => ctx.navigate("models")}>
              返回模型列表
            </button>
          </div>
        }
      >
        <ResizablePanels
          left={
            <section class="panel source-panel" classList={{ "schema-collapsed": !schemaOpen() }}>
              <div class="editor-heading">
                <h2>
                  <button
                    class="section-toggle"
                    type="button"
                    aria-expanded={schemaOpen()}
                    aria-controls={schemaId}
                    onClick={() => setSchemaOpen((value) => !value)}
                  >
                    <Icon name="code" />
                    Schema JSON
                    <Icon name="chevron" class="ui-icon disclosure-chevron" />
                  </button>
                </h2>
                <span
                  class="draft-state"
                  classList={{ dirty: versionNumber() === undefined && dirty() }}
                >
                  {stateLabel()}
                </span>
              </div>
              <div id={schemaId} class="schema-body" hidden={!schemaOpen()}>
                <div class="editor-toolbar">
                  <code>
                    {modelId()} · {(historical()?.revision ?? revision())?.slice(0, 8) ?? "新建"}
                  </code>
                  <span>{versionNumber() !== undefined ? "历史版本 · 只读" : "JSON"}</span>
                </div>
                <JsonEditor
                  value={source()}
                  readOnly={versionNumber() !== undefined || !snapshot()?.canManage}
                  disabled={busy()}
                  onChange={(value) => {
                    if (versionNumber() !== undefined) return;
                    setDraft(value);
                    setDirty(true);
                  }}
                />
                <div class="editor-footer">
                  <span>{source().split("\n").length} 行</span>
                  <span>UTF-8</span>
                </div>
              </div>
              <section class="diagnostics" aria-label="草稿诊断">
                <h2>
                  <button
                    class="section-toggle"
                    type="button"
                    aria-expanded={diagnosticsOpen()}
                    aria-controls={diagnosticsId}
                    onClick={() => setDiagnosticsOpen((value) => !value)}
                  >
                    草稿诊断
                    <Show when={diagnostics().length}>
                      <span class="diagnostic-count">{diagnostics().length}</span>
                    </Show>
                    <Icon name="chevron" class="ui-icon disclosure-chevron" />
                  </button>
                </h2>
                <div id={diagnosticsId} hidden={!diagnosticsOpen()}>
                  <For each={diagnostics()}>
                    {(issue) => (
                      <p role="alert">
                        <code>{issue.path || "/"}</code> · {issue.code} · {issue.message}
                      </p>
                    )}
                  </For>
                  <Show when={!diagnostics().length}>
                    <p class="muted">
                      {versionNumber() !== undefined
                        ? `v${versionNumber()} 为已发布版本，Schema 只读。`
                        : dirty()
                          ? "保存后返回最新诊断。"
                          : "没有可确定错误。"}
                    </p>
                  </Show>
                  <For
                    each={
                      versionNumber() !== undefined
                        ? []
                        : (snapshot()?.diagnostics.runtimeChecks ?? [])
                    }
                  >
                    {(issue) => (
                      <p class="muted">
                        <code>{issue.path}</code> · {issue.message}
                      </p>
                    )}
                  </For>
                </div>
              </section>
            </section>
          }
          right={
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
          }
        />
      </Show>
    </div>
  );
};
