import { Dialog } from "@kobalte/core/dialog";
import { createResource, createSignal, For, Show } from "solid-js";
import type { Component } from "solid-js";
import type { ActionContext } from "formwork";
import { errorPayload, modelIdPattern } from "formwork/model";
import { sessionUser } from "../models";
import { modelMenu, modelMenuLoading, refreshModelMenu, setModelPinned } from "../model-menu";
import { Icon } from "../ui/icons";
import { McpGuide } from "../ui/mcp-guide";
import { PageTopbar } from "../ui/page-topbar";

/** 展示管理模型目录，创建共享草稿，并按账号固定已发布的业务入口。 */
export const ModelList: Component<ActionContext> = (ctx) => {
  const [directory, { refetch }] = createResource(() =>
    ctx.api.models.list({ signal: ctx.signal }),
  );
  const entries = () => (directory.error ? [] : (directory() ?? []));
  const [open, setOpen] = createSignal(false);
  const [id, setId] = createSignal("");
  const [creating, setCreating] = createSignal(false);
  const [createFailure, setCreateFailure] = createSignal("");
  const [pending, setPending] = createSignal<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const pinned = (modelId: string) =>
    !!modelMenu()?.pinnedModels.some((entry) => entry.id === modelId);
  const toggle = async (modelId: string) => {
    if (pending().has(modelId)) return;
    setPending(new Set([...pending(), modelId]));
    setErrors((value) => ({ ...value, [modelId]: "" }));
    try {
      await setModelPinned(modelId, !pinned(modelId));
    } catch (error) {
      if (!ctx.signal.aborted)
        setErrors((value) => ({ ...value, [modelId]: errorPayload(error).message }));
    } finally {
      if (!ctx.signal.aborted)
        setPending((value) => new Set([...value].filter((item) => item !== modelId)));
    }
  };
  return (
    <Dialog
      open={open()}
      onOpenChange={(value) => {
        if (!creating()) setOpen(value);
      }}
    >
      <div class="model-list-page">
        <PageTopbar
          title={<h1>模型列表</h1>}
          actions={
            <>
              <button
                class="button secondary"
                disabled={directory.loading}
                onClick={() => {
                  void refetch();
                  void refreshModelMenu();
                }}
              >
                <Icon name="refresh" />
                刷新列表
              </button>
              <Show when={sessionUser()?.canCreateModel}>
                <Dialog.Trigger class="button" onClick={() => setCreateFailure("")}>
                  <Icon name="plus" />
                  新建模型
                </Dialog.Trigger>
              </Show>
            </>
          }
        />
        <McpGuide />
        <Show when={directory.error}>
          <p role="alert">
            {errorPayload(directory.error).message}{" "}
            <button class="text-button" onClick={() => refetch()}>
              重试列表
            </button>
          </p>
        </Show>
        <section class="panel model-directory">
          <div
            class="table-scroll"
            tabindex="0"
            aria-label="模型表格，可横向滚动"
            aria-busy={directory.loading}
          >
            <table aria-label="模型列表">
              <thead>
                <tr>
                  <th>模型名称</th>
                  <th>ID</th>
                  <th>类型</th>
                  <th>管理状态</th>
                  <th>已发布版本</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <For each={entries()}>
                  {(entry) => (
                    <tr data-model-id={entry.id}>
                      <td>
                        <button
                          class="text-button model-name"
                          onClick={() => ctx.navigate("models", { domain: entry.id })}
                        >
                          <Icon name="model" />
                          {entry.title || entry.id}
                        </button>
                      </td>
                      <td>
                        <code>{entry.id}</code>
                      </td>
                      <td>
                        <span class="value-badge">
                          {entry.id.startsWith("system-") ? "系统模型" : "用户模型"}
                        </span>
                      </td>
                      <td>
                        <span
                          class="value-badge"
                          classList={{
                            pending: entry.stage === "draft",
                            positive: entry.stage === "published",
                          }}
                        >
                          {entry.stage === "draft" ? "草稿" : "已发布"}
                        </span>
                      </td>
                      <td class="muted">
                        {entry.publishedVersion === null ? "未发布" : `v${entry.publishedVersion}`}
                      </td>
                      <td class="model-operations">
                        <div class="actions">
                          <button
                            class="text-button"
                            onClick={() => ctx.navigate("models", { domain: entry.id })}
                          >
                            详情
                          </button>
                          <Show when={!entry.id.startsWith("system-")}>
                            <button
                              class="text-button pin-button"
                              aria-pressed={pinned(entry.id)}
                              disabled={
                                pending().has(entry.id) ||
                                (!pinned(entry.id) &&
                                  (entry.publishedVersion === null ||
                                    !modelMenu()?.pinnableModelIds.includes(entry.id)))
                              }
                              title={
                                entry.publishedVersion === null
                                  ? "发布后可固定"
                                  : !modelMenu()
                                    ? "正在同步菜单"
                                    : !modelMenu()?.pinnableModelIds.includes(entry.id)
                                      ? "无记录读取权限"
                                      : undefined
                              }
                              onClick={() => toggle(entry.id)}
                            >
                              <Icon name="pin" />
                              {pending().has(entry.id)
                                ? "正在同步…"
                                : pinned(entry.id)
                                  ? "取消固定"
                                  : "固定到菜单"}
                            </button>
                            <Show when={entry.publishedVersion === null}>
                              <span class="muted">发布后可固定</span>
                            </Show>
                            <Show
                              when={
                                entry.publishedVersion !== null &&
                                modelMenu() &&
                                !modelMenu()?.pinnableModelIds.includes(entry.id)
                              }
                            >
                              <span class="muted">无记录读取权限</span>
                            </Show>
                          </Show>
                        </div>
                        <Show when={errors()[entry.id]}>
                          <p class="pin-error" role="alert">
                            {errors()[entry.id]}
                          </p>
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
          <Show when={directory.loading}>
            <p class="query-loading" role="status">
              正在加载模型…
            </p>
          </Show>
          <Show when={!directory.loading && !directory.error && entries().length === 0}>
            <div class="table-empty">
              <Icon name="model" />
              <p>暂无可管理的模型</p>
              <span>
                {sessionUser()?.canCreateModel
                  ? "点击新建模型开始。"
                  : "请联系管理员分配模型管理权限。"}
              </span>
            </div>
          </Show>
          <div class="table-footer">
            <span class="muted">共 {entries().length} 个模型</span>
            <Show when={modelMenuLoading()}>
              <span class="muted">正在同步菜单…</span>
            </Show>
          </div>
        </section>
      </div>
      <Dialog.Portal>
        <Dialog.Overlay class="window-overlay" />
        <Dialog.Content class="window-content model-create-dialog">
          <div class="dialog-title-row">
            <Dialog.Title>新建模型</Dialog.Title>
            <Dialog.CloseButton class="icon-button" aria-label="关闭新建模型" disabled={creating()}>
              <Icon name="close" />
            </Dialog.CloseButton>
          </div>
          <Dialog.Description class="muted">
            保存初始草稿后进入 Schema 编辑与预览。
          </Dialog.Description>
          <form
            class="new-model-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (creating()) return;
              const modelId = id().trim();
              if (!modelIdPattern.test(modelId) || modelId.startsWith("system-")) {
                setCreateFailure("模型 ID 必须是单段小写标识，不能使用 system- 前缀。");
                return;
              }
              setCreating(true);
              setCreateFailure("");
              try {
                await ctx.api.models.saveDraft(
                  modelId,
                  {
                    document: {
                      id: modelId,
                      title: modelId,
                      data: { type: "object", properties: {}, additionalProperties: false },
                    },
                    backend: {
                      storage: { table: `biz_${modelId.replaceAll("-", "_")}`, bindings: [] },
                      relations: [],
                      permissions: { grants: [], privateFields: [] },
                      behavior: { rules: [], commands: {}, events: {} },
                    },
                  },
                  { ifRevision: null, signal: ctx.signal },
                );
                if (!ctx.signal.aborted) ctx.navigate("models", { domain: modelId });
              } catch (error) {
                if (!ctx.signal.aborted) setCreateFailure(errorPayload(error).message);
              } finally {
                if (!ctx.signal.aborted) setCreating(false);
              }
            }}
          >
            <label for="new-model-id">模型 ID</label>
            <input
              id="new-model-id"
              class="control"
              aria-label="新模型 ID"
              placeholder="例如 customer-orders"
              value={id()}
              onInput={(event) => setId(event.currentTarget.value)}
              required
              disabled={creating()}
            />
            <Show when={createFailure()}>
              <p role="alert">{createFailure()}</p>
            </Show>
            <div class="actions">
              <button class="button" disabled={creating()}>
                {creating() ? "正在创建…" : "创建模型"}
              </button>
              <Dialog.CloseButton class="button secondary" disabled={creating()}>
                取消
              </Dialog.CloseButton>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
