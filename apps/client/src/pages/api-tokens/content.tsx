import { createResource, createSignal, For, Show } from "solid-js";
import type { Component } from "solid-js";
import type { PageContext } from "formwork";
import { api } from "../../formwork/api";
import { ErrorMessage, Message } from "../../components/ui/message";
import { Popconfirm } from "../../components/ui/popconfirm";
import { sessionUser } from "../../formwork/api";
import { PageTopbar } from "../../formwork/shell/page-topbar";

/** 签发并撤销本人 API token，明文仅在签发结果中出现一次。 */
export const ApiTokens: Component<PageContext> = (ctx) => {
  const [directory, { refetch }] = createResource(() => api.auth.tokens({ signal: ctx.signal }));
  const [issued, setIssued] = createSignal("");
  const [busy, setBusy] = createSignal(false);
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
          class="panel token-form"
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
          <label>
            用途
            <input class="control" name="label" required maxlength="120" />
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
            身份
            <select class="control" name="kind">
              <option value="agent">agent · 编辑共享草稿</option>
              <Show when={sessionUser()?.super}>
                <option value="deploy">deploy · 登记能力清单</option>
              </Show>
            </select>
          </label>
          <button class="button" disabled={busy()}>
            签发 token
          </button>
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
        <section class="panel table-scroll" tabindex="0" aria-label="token 表格，可横向滚动">
          <table aria-label="本人 token 目录">
            <thead>
              <tr>
                <th>用途</th>
                <th>身份</th>
                <th>有效期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <For each={directory.error ? [] : (directory() ?? [])}>
                {(entry) => (
                  <tr>
                    <td>{entry.label}</td>
                    <td>{entry.kind}</td>
                    <td>{new Date(entry.expiresAt).toLocaleString("zh-CN")}</td>
                    <td>{entry.revokedAt ? "已撤销" : "有效"}</td>
                    <td>
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
          <Show when={directory.loading}>
            <p role="status">正在加载 token…</p>
          </Show>
        </section>
      </Show>
    </div>
  );
};
