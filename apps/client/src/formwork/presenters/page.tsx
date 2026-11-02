import { useLocation } from "@solidjs/router";
import { Show } from "solid-js";
import type { Component } from "solid-js";
import type { PresenterProps } from "formwork";
import { AppShell } from "../shell/app-shell";

/** 用登录页、预览画布或应用外壳承载完整页面，并提供 Window 返回操作。 */
export const PagePresenter: Component<PresenterProps> = (props) => {
  const location = useLocation();
  const content = () => <>
    <Show when={props.window}><button class="text-button" onClick={props.close}>返回列表</button></Show>
    {props.children}
  </>;
  return (
    <Show when={!location.pathname.startsWith("/model-preview/") && location.pathname !== "/login"}
      fallback={
        <main class={location.pathname === "/login" ? "auth-layout" : "page-canvas embedded-canvas"}>
          {content()}
        </main>
      }>
      <AppShell>{content()}</AppShell>
    </Show>
  );
};
