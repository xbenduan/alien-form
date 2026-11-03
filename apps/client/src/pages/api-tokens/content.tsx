import { createResource, createSignal, For, Show } from "solid-js";
import type { Component } from "solid-js";
import type { PageContext } from "formwork";
import { api } from "../../formwork/api";
import { ErrorMessage, Message } from "../../components/ui/message";
import { Popconfirm } from "../../components/ui/popconfirm";
import { SelectControl } from "../../components/ui/select";
import { sessionUser } from "../../formwork/api";
import { PageTopbar } from "../../formwork/shell/page-topbar";
import { Icon } from "../../formwork/shell/icons";

/** 签发并撤销本人 API token，明文仅在签发结果中出现一次。 */
export const ApiTokens: Component<PageContext> = (ctx) => {
  const [directory, { refetch }] = createResource(() => api.auth.tokens({ signal: ctx.signal }));
  const [issued, setIssued] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [kind, setKind] = createSignal("agent");
  const entries = () => (directory.error ? [] : (directory() ?? []));
  const run = async (action: () => Promise<unknown>) => {
    if (busy()) return false;
    setBusy(true);
    try {
      await action();
      await refetch();
      return true;
    } catch (error) {
      if (!ctx.signal.aborted) Message.error(error);
      return false;
    } finally {
      if (!ctx.signal.aborted) setBusy(false);
    }
  };
  return (
    <div class="token-page">
      <PageTopbar title={<h1>API token</h1>} />
      <Show
        when={sessionUser()?.kind === "user"}
        fallback={<ErrorMessage error="仅用户登录会话可以签发或撤销 token。" />}
      >
        <form
          class="panel token-create"
          aria-busy={busy()}
          onSubmit={(event) => {
            event.preventDefault();
            const input = new FormData(event.currentTarget);
            void run(async () => {
              setIssued("");
              const result = await api.auth.issueToken(
                {
                  label: String(input.get("label")),
                  kind: input.get("kind") === "deploy" ? "deploy" : "agent",
                  expiresInDays: Number(input.get("days")),
                },
                { signal: ctx.signal },
              );
              if (!ctx.signal.aborted) setIssued(result.token);
            });
          }}
        >
          <div class="panel-heading">
            <h2>
              <Icon name="key" />
              签发访问凭证
            </h2>
          </div>
          <div class="token-form">
            <label>
              用途
              <input
                class="control"
                name="label"
                placeholder="例如：AI 客户端"
                required
                maxlength="120"
              />
            </label>
            <label>
              有效天数
              <input
                class="control"
                name="days"
                type="number"
                min="1"
                max="365"
                value="30"
                required
              />
            </label>
            <label>
              <span id="token-kind-label">身份</span>
              <input type="hidden" name="kind" value={kind()} />
              <SelectControl
                labelledBy="token-kind-label"
                value={kind()}
                onChange={(value) => setKind(value ?? "agent")}
                disabled={busy()}
                options={[
                  { value: "agent", label: "agent · 编辑共享草稿" },
                  ...(sessionUser()?.super
                    ? [{ value: "deploy", label: "deploy · 登记能力清单" }]
                    : []),
                ]}
              />
            </label>
            <button class="button" disabled={busy()}>
              <Icon name="plus" />
              签发 token
            </button>
          </div>
        </form>
        <Show when={issued()}>
          <section class="panel issued-token" aria-label="新 token">
            <p>请立即保存，关闭后无法再次查看明文。</p>
            <textarea class="control" aria-label="token 明文" readOnly value={issued()} />
            <button class="button secondary" onClick={() => setIssued("")}>
              关闭明文
            </button>
          </section>
        </Show>
        <ErrorMessage error={directory.error} retry={refetch} />
        <section class="panel token-directory">
          <div
            class="table-scroll"
            tabindex="0"
            aria-label="token 表格，可横向滚动"
            aria-busy={directory.loading}
          >
            <table aria-label="本人 token 目录">
              <thead>
                <tr>
                  <th>用途</th>
                  <th>身份</th>
                  <th>有效期</th>
                  <th>状态</th>
                  <th class="operation-cell">操作</th>
                </tr>
              </thead>
              <tbody>
                <For each={entries()}>
                  {(entry) => (
                    <tr>
                      <td>{entry.label}</td>
                      <td>
                        <span class="source-pill">{entry.kind}</span>
                      </td>
                      <td class="muted">
                        <time datetime={entry.expiresAt}>
                          {new Date(entry.expiresAt).toLocaleString("zh-CN")}
                        </time>
                      </td>
                      <td>
                        <span class="value-badge" classList={{ positive: !entry.revokedAt }}>
                          <span class="status-dot" aria-hidden="true" />
                          {entry.revokedAt ? "已撤销" : "有效"}
                        </span>
                      </td>
                      <td class="operation-cell">
                        <Popconfirm
                          message={`确定撤销「${entry.label}」吗？撤销后该 token 将立即失效。`}
                          disabled={busy() || !!entry.revokedAt}
                          onConfirm={() =>
                            run(() => api.auth.revokeToken(entry.id, { signal: ctx.signal }))
                          }
                        >
                          撤销
                        </Popconfirm>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
          <Show when={directory.loading}>
            <p class="query-loading" role="status">
              正在加载 token…
            </p>
          </Show>
          <Show when={!directory.loading && !directory.error && entries().length === 0}>
            <div class="table-empty">
              <Icon name="key" />
              <p>暂无 API token</p>
              <span>填写用途并签发 token，即可连接 AI 客户端。</span>
            </div>
          </Show>
          <div class="table-footer">
            <span class="muted">共 {entries().length} 个 token</span>
          </div>
        </section>
      </Show>
    </div>
  );
};
