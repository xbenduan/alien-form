import { createSignal } from "solid-js";
import type { Component } from "solid-js";
import type { PageContext } from "formwork";
import { Message } from "../../components/ui/message";
import { login } from "../../formwork/api";
import { BrandMark } from "../../formwork/shell/icons";

/** 用 Worker 密码登录建立当前标签页会话。 */
export const Login: Component<PageContext> = (ctx) => {
  const [busy, setBusy] = createSignal(false);
  return (
    <form
      class="panel auth-panel"
      aria-labelledby="login-heading"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy()) return;
        const input = new FormData(event.currentTarget);
        setBusy(true);
        try {
          await login(String(input.get("username")), String(input.get("password")), ctx.signal);
          if (!ctx.signal.aborted) ctx.navigate("/models");
        } catch (error) {
          if (!ctx.signal.aborted) Message.error(error);
        } finally {
          if (!ctx.signal.aborted) setBusy(false);
        }
      }}
    >
      <div class="auth-intro">
        <BrandMark />
        <h1 id="login-heading">登录 ALIEN CMS</h1>
        <p class="muted">管理模型、发布版本和业务记录。</p>
      </div>
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
      <button class="button" disabled={busy()}>
        {busy() ? "正在登录…" : "登录"}
      </button>
    </form>
  );
};
