import { createResource, createSignal, For, Show } from "solid-js";
import type { Component } from "solid-js";
import type { ActionContext } from "formwork";
import { errorPayload } from "formwork/model";
import { sessionUser } from "../models";
import { PageTopbar } from "../ui/page-topbar";

/** 签发并撤销本人 API token，明文仅在签发结果中出现一次。 */
export const ApiTokens: Component<ActionContext> = (ctx) => {
  const [directory, { refetch }] = createResource(() =>
    ctx.api.auth.tokens({ signal: ctx.signal }),
  );
  const [issued, setIssued] = createSignal("");
  const [failure, setFailure] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const run = async (action: () => Promise<unknown>) => {
    if (busy()) return;
    setBusy(true);
    setFailure("");
    try {
      await action();
      await refetch();
    } catch (error) {
      if (!ctx.signal.aborted) setFailure(errorPayload(error).message);
    } finally {
      if (!ctx.signal.aborted) setBusy(false);
    }
  };
  return (
    <div class="token-page">
      <PageTopbar title={<h1>API token</h1>} />
      <Show
        when={sessionUser()?.kind === "user"}
        fallback={<p role="alert">仅用户登录会话可以签发或撤销 token。</p>}
      >
        <form
          class="panel token-form"
          onSubmit={(event) => {
            event.preventDefault();
            const input = new FormData(event.currentTarget);
            void run(async () => {
              setIssued("");
              const result = await ctx.api.auth.issueToken(
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
        <Show when={failure() || directory.error}>
          <p role="alert">{failure() || errorPayload(directory.error).message}</p>
        </Show>
        <section class="panel table-scroll">
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
                      <button
                        class="text-button danger"
                        disabled={busy() || !!entry.revokedAt}
                        onClick={() =>
                          run(() => ctx.api.auth.revokeToken(entry.id, { signal: ctx.signal }))
                        }
                      >
                        撤销
                      </button>
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
