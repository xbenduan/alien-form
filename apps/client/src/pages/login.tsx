import { createSignal, Show } from "solid-js";
import type { Component } from "solid-js";
import type { ActionContext } from "formwork";
import { errorPayload } from "formwork/model";
import { login } from "../models";
import { PageTopbar } from "../ui/page-topbar";

/** 用 Worker 密码登录建立当前标签页会话。 */
export const Login: Component<ActionContext> = (ctx) => {
  const [busy, setBusy] = createSignal(false);
  const [failure, setFailure] = createSignal("");
  return (
    <>
      <PageTopbar title={<h1>登录 Alien Form</h1>} />
      <form
        class="panel auth-panel"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy()) return;
          const input = new FormData(event.currentTarget);
          setBusy(true);
          setFailure("");
          try {
            await login(String(input.get("username")), String(input.get("password")), ctx.signal);
            if (!ctx.signal.aborted) ctx.navigate("models");
          } catch (error) {
            if (!ctx.signal.aborted) setFailure(errorPayload(error).message);
          } finally {
            if (!ctx.signal.aborted) setBusy(false);
          }
        }}
      >
        <p class="muted">登录后管理模型草稿、发布版本和业务记录。</p>
        <label>
          用户名
          <input class="control" name="username" autocomplete="username" required />
        </label>
        <label>
          密码
          <input
            class="control"
            name="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>
        <Show when={failure()}>
          <p role="alert">{failure()}</p>
        </Show>
        <button class="button" disabled={busy()}>
          {busy() ? "正在登录…" : "登录"}
        </button>
      </form>
    </>
  );
};
