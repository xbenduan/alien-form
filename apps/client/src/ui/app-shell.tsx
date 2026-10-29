import { A, useLocation, useNavigate } from "@solidjs/router";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import { logout, sessionLoading, sessionToken, sessionUser } from "../models";
import { BrandMark, Icon } from "./icons";

const navigation = [
  { href: "/models", title: "模型工作台", icon: "model" },
  { href: "/list/orders", title: "订单管理", icon: "orders" },
  { href: "/list/cms", title: "内容管理", icon: "content" },
  { href: "/tokens", title: "API token", icon: "code" },
] as const;

/** 为页面提供统一导航和可信登录身份，未登录时进入登录页。 */
export const AppShell: Component<{ children?: JSX.Element }> = (props) => {
  const location = useLocation();
  const navigate = useNavigate();
  let alive = true;
  onCleanup(() => {
    alive = false;
  });
  createEffect(() => {
    if (!sessionLoading() && !sessionToken() && location.pathname !== "/login") {
      // Presenter 构造时 Host 尚未登记 frame；延后导航避免被 Host 的 history replace 覆盖。
      queueMicrotask(() => {
        if (alive && !sessionToken() && location.pathname !== "/login")
          navigate("/login", { replace: true, state: {} });
      });
    }
  });
  const [failure, setFailure] = createSignal("");
  const current = () => {
    if (location.pathname.startsWith("/models")) return navigation[0];
    if (location.pathname.includes("/orders")) return navigation[1];
    if (location.pathname.includes("/cms")) return navigation[2];
    if (location.pathname.startsWith("/tokens")) return navigation[3];
    return navigation[0];
  };
  return (
    <div class="app-shell">
      <a class="skip-link" href="#main-content">
        跳转到内容
      </a>
      <aside class="sidebar">
        <A href="/models" class="brand" aria-label="Alien Form 首页">
          <BrandMark />
          <span class="brand-name">Alien Form</span>
        </A>
        <nav class="main-nav" aria-label="主导航">
          <For each={navigation}>
            {(item) => (
              <A
                href={item.href}
                class="nav-item"
                classList={{ "is-active": current().href === item.href }}
                aria-label={item.title}
                title={item.title}
                aria-current={current().href === item.href ? "page" : undefined}
              >
                <Icon name={item.icon} />
                <span>{item.title}</span>
              </A>
            )}
          </For>
        </nav>
        <div class="sidebar-bottom">
          <Icon name="layers" />
          <span>Formwork</span>
        </div>
      </aside>
      <div class="app-main">
        <header class="topbar">
          <div class="breadcrumb">
            <span>{current().title}</span>
          </div>
          <div class="topbar-actions">
            <Show when={sessionUser()}>
              {(actor) => (
                <>
                  <span class="source-indicator">
                    {actor().username} · {actor().kind}
                  </span>
                  <button
                    class="text-button"
                    onClick={async () => {
                      try {
                        await logout();
                      } catch {
                        setFailure("会话已在本页清除，服务端注销失败。");
                      }
                    }}
                  >
                    退出
                  </button>
                </>
              )}
            </Show>
          </div>
        </header>
        <main id="main-content" class="page-canvas" tabindex="-1">
          <Show when={failure()}>
            <p role="alert">{failure()}</p>
          </Show>
          <Show when={!sessionLoading()} fallback={<p role="status">正在核实登录会话…</p>}>
            <Show when={sessionToken() || location.pathname === "/login"}>{props.children}</Show>
          </Show>
        </main>
      </div>
    </div>
  );
};
