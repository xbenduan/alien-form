import { Dialog } from "@kobalte/core/dialog";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import type { Component } from "solid-js";
import type { PageContext } from "formwork";
import { modelIdPattern } from "formwork/model";
import { ErrorMessage, Message } from "../../components/ui/message";
import { api, sessionUser } from "../../formwork/api";
import {
  modelMenu,
  modelMenuLoading,
  refreshModelMenu,
  setModelPinned,
} from "../../formwork/shell/model-menu";
import { Icon } from "../../formwork/shell/icons";
import { McpGuide } from "../../formwork/shell/mcp-guide";
import { PageTopbar } from "../../formwork/shell/page-topbar";

/** 展示管理模型目录，创建共享草稿，并按账号固定已发布的业务入口。 */
export const ModelList: Component<PageContext> = (ctx) => {
  const [root, setRoot] = createSignal<HTMLElement>();
  const [directory, { refetch }] = createResource(() => api.models.list({ signal: ctx.signal }));
  const entries = () => (directory.error ? [] : (directory() ?? []));
  const [search, setSearch] = createSignal("");
  const visibleEntries = createMemo(() => {
    const query = search().trim().toLocaleLowerCase();
    return entries().filter(
      (entry) => !query || `${entry.title} ${entry.id}`.toLocaleLowerCase().includes(query),
    );
  });
  const [open, setOpen] = createSignal(false);
  const [id, setId] = createSignal("");
  const [creating, setCreating] = createSignal(false);
  const [pending, setPending] = createSignal<ReadonlySet<string>>(new Set());
  const pinned = (modelId: string) =>
    !!modelMenu()?.pinnedModels.some((entry) => entry.id === modelId);
  const toggle = async (modelId: string) => {
    if (pending().has(modelId)) return;
    setPending(new Set([...pending(), modelId]));
    try {
      await setModelPinned(modelId, !pinned(modelId));
    } catch (error) {
      if (!ctx.signal.aborted) Message.error(error);
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
      <div class="model-list-page" ref={setRoot}>
        <PageTopbar
          title={<h1>模型列表</h1>}
          actions={
            <>
              <a
                class="button secondary"
                href="/learning-center/index.html"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="学习中心（新标签页打开）"
              >
                <Icon name="book" />
                学习中心
              </a>
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
                <Dialog.Trigger class="button">
                  <Icon name="plus" />
                  新建模型
                </Dialog.Trigger>
              </Show>
            </>
          }
        />
        <ErrorMessage error={directory.error} retry={refetch} retryLabel="重试列表" />
        <section class="panel model-directory">
          <div class="model-directory-toolbar">
            <label class="model-search">
              <span class="sr-only">搜索模型</span>
              <Icon name="search" />
              <input
                class="control"
                type="search"
                placeholder="搜索模型名称或 ID"
                value={search()}
                onInput={(event) => setSearch(event.currentTarget.value)}
              />
            </label>
            <span class="muted model-count" role="status">
              {search().trim()
                ? `${visibleEntries().length} / ${entries().length} 个模型`
                : `${entries().length} 个模型`}
            </span>
          </div>
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
                  <th class="operation-cell">操作</th>
                </tr>
              </thead>
              <tbody>
                <For each={visibleEntries()}>
                  {(entry) => (
                    <tr data-model-id={entry.id}>
                      <td>
                        <button
                          class="text-button model-name"
                          onClick={() =>
                            ctx.navigate(`/models?modelId=${encodeURIComponent(entry.id)}`)
                          }
                        >
                          <Icon name="model" />
                          {entry.title || entry.id}
                        </button>
                      </td>
                      <td>
                        <code>{entry.id}</code>
                      </td>
                      <td>
                        <span
                          class="value-badge"
                          classList={{ "model-type-system": entry.id.startsWith("system-") }}
                        >
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
                          <span class="status-dot" aria-hidden="true" />
                          {entry.stage === "draft" ? "草稿" : "已发布"}
                        </span>
                      </td>
                      <td class="muted">
                        {entry.publishedVersion === null ? "未发布" : `v${entry.publishedVersion}`}
                      </td>
                      <td class="operation-cell model-operations">
                        <div class="actions">
                          <button
                            class="text-button"
                            onClick={() =>
                              ctx.navigate(`/models?modelId=${encodeURIComponent(entry.id)}`)
                            }
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
          <Show
            when={
              !directory.loading &&
              !directory.error &&
              entries().length > 0 &&
              visibleEntries().length === 0
            }
          >
            <div class="table-empty">
              <Icon name="search" />
              <p>没有匹配的模型</p>
              <button class="text-button" onClick={() => setSearch("")}>
                清除搜索
              </button>
            </div>
          </Show>
          <div class="table-footer">
            <span class="muted">共 {entries().length} 个模型</span>
            <Show when={modelMenuLoading()}>
              <span class="muted">正在同步菜单…</span>
            </Show>
          </div>
        </section>
        <McpGuide />
      </div>
      <Dialog.Portal mount={root()?.closest<HTMLElement>("[data-formwork-root]") ?? undefined}>
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
                Message.error("模型 ID 必须是单段小写标识，不能使用 system- 前缀。");
                return;
              }
              setCreating(true);
              try {
                await api.models.saveDraft(
                  modelId,
                  {
                    schemaVersion: 1,
                    id: modelId,
                    title: modelId,
                    data: {},
                  },
                  { ifRevision: null, signal: ctx.signal },
                );
                if (!ctx.signal.aborted)
                  ctx.navigate(`/models?modelId=${encodeURIComponent(modelId)}`);
              } catch (error) {
                if (!ctx.signal.aborted) Message.error(error);
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
            <div class="actions">
              <button class="button" disabled={creating()}>
                {creating() ? "正在创建…" : "创建模型"}
              </button>
              <Dialog.CloseButton class="button secondary" aria-label="取消" disabled={creating()}>
                取消
              </Dialog.CloseButton>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};
