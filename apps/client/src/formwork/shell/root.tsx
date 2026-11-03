import { useLocation } from "@solidjs/router";
import { Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import { AppShell } from "./app-shell";

/** 将登录、模型预览和业务页面放入对应的应用外壳。 */
export const Shell: Component<{ children?: JSX.Element }> = (props) => {
  const location = useLocation();
  return (
    <Show
      when={location.pathname !== "/login" && location.pathname !== "/model-preview"}
      fallback={
        <main
          class={
            location.pathname === "/login"
              ? "auth-layout"
              : "page-canvas embedded-layout embedded-canvas"
          }
        >
          {props.children}
        </main>
      }
    >
      <AppShell>{props.children}</AppShell>
    </Show>
  );
};
