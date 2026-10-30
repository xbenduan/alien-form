import { A, useLocation, useNavigate } from "@solidjs/router";
import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import {
  logout,
  retrySession,
  sessionFailure,
  sessionLoading,
  sessionToken,
  sessionUser,
} from "../models";
import { modelMenu, modelMenuFailure, modelMenuLoading, refreshModelMenu } from "../model-menu";
import { BrandMark, Icon } from "./icons";
import { registerTopbar } from "./page-topbar";

const [pinnedOpen, setPinnedOpen] = createSignal(true);

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
  const [pageActive, setPageActive] = createSignal(false);
  let titleSlot!: HTMLDivElement;
  let actionsSlot!: HTMLDivElement;
  const domain = () => location.pathname.split("/")[2];
  const active = (href: string) => {
    if (href === "/models") return location.pathname.startsWith("/models");
    if (href.startsWith("/list/"))
      return (
        ["list", "add", "edit", "detail"].includes(location.pathname.split("/")[1] ?? "") &&
        domain() === href.split("/")[2]
      );
    return location.pathname === href;
  };
  const fallbackTitle = () => {
    if (location.pathname === "/login") return "登录 Alien Form";
    if (location.pathname.startsWith("/tokens")) return "API token";
    if (location.pathname.startsWith("/models")) return domain() ?? "模型列表";
    return (
      [...(modelMenu()?.systemModels ?? []), ...(modelMenu()?.pinnedModels ?? [])].find(
        (entry) => entry.id === domain(),
      )?.title ??
      domain() ??
      "模型列表"
    );
  };
  createEffect(
    on(
      () => [location.pathname, sessionToken(), sessionUser()],
      () => {
        void refreshModelMenu();
      },
    ),
  );
  onMount(() => {
    const unregister = registerTopbar({
      title: titleSlot,
      actions: actionsSlot,
      active: () => setPageActive(true),
      inactive: () => setPageActive(false),
    });
    const refresh = () => void refreshModelMenu();
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    onCleanup(() => {
      unregister();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    });
  });
  const NavItem: Component<{
    href: string;
    title: string;
    icon?: Parameters<typeof Icon>[0]["name"];
  }> = (item) => (
    <A
      href={item.href}
      class="nav-item"
      classList={{ "is-active": active(item.href) }}
      aria-label={item.title}
      title={item.title}
      aria-current={active(item.href) ? "page" : undefined}
    >
      <Show when={item.icon}>{(name) => <Icon name={name()} />}</Show>
      <span>{item.title}</span>
    </A>
  );
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
          <div class="nav-group" aria-label="模型与系统">
            <span class="nav-group-label">模型与系统</span>
            <NavItem href="/models" title="模型列表" icon="model" />
            <For each={modelMenu()?.systemModels ?? []}>
              {(entry) => (
                <NavItem
                  href={`/list/${entry.id}`}
                  title={entry.title}
                  icon={
                    entry.id === "system-users"
                      ? "user"
                      : entry.id === "system-roles"
                        ? "roles"
                        : "grid"
                  }
                />
              )}
            </For>
            <NavItem href="/tokens" title="API token" icon="key" />
          </div>
          <div class="nav-group pinned-group" aria-label="已固定模型">
            <button
              class="nav-group-toggle"
              type="button"
              aria-expanded={pinnedOpen()}
              aria-controls="pinned-model-links"
              onClick={() => setPinnedOpen((value) => !value)}
            >
              <span>已固定模型</span>
              <span class="nav-group-count">{modelMenu()?.pinnedModels.length ?? 0}</span>
              <Icon name="chevron" class="ui-icon disclosure-chevron" />
            </button>
            <div id="pinned-model-links" class="pinned-links" hidden={!pinnedOpen()}>
              <For
                each={modelMenu()?.pinnedModels ?? []}
                fallback={
                  <span class="nav-empty">
                    {modelMenuLoading() && !modelMenu() ? "正在加载…" : "暂无固定模型"}
                  </span>
                }
              >
                {(entry) => <NavItem href={`/list/${entry.id}`} title={entry.title} />}
              </For>
            </div>
          </div>
          <Show when={modelMenuFailure()}>
            <div class="nav-error" role="alert">
              {modelMenuFailure()}
              <button
                class="text-button"
                disabled={modelMenuLoading()}
                onClick={() => refreshModelMenu()}
              >
                重试菜单
              </button>
            </div>
          </Show>
        </nav>
        <div class="sidebar-bottom">
          <Show
            when={sessionUser()}
            fallback={
              <A class="nav-item" href="/login" aria-label="登录">
                <Icon name="user" />
                <span>登录</span>
              </A>
            }
          >
            {(actor) => (
              <div class="account-row">
                <Icon name="user" />
                <span class="account-name" title={actor().username}>
                  {actor().username}
                </span>
                <button
                  class="text-button"
                  onClick={async () => {
                    setFailure("");
                    try {
                      await logout();
                    } catch {
                      setFailure("会话已在本页清除，服务端注销失败。");
                    }
                  }}
                >
                  退出
                </button>
              </div>
            )}
          </Show>
          <Show when={failure()}>
            <p role="alert">{failure()}</p>
          </Show>
        </div>
      </aside>
      <div class="app-main">
        <header class="topbar">
          <div class="page-title topbar-title">
            <Show when={!pageActive()}>
              <h1>{fallbackTitle()}</h1>
            </Show>
            <div
              ref={(element) => {
                titleSlot = element;
              }}
              class="topbar-title-slot"
            />
          </div>
          <div
            ref={(element) => {
              actionsSlot = element;
            }}
            class="topbar-actions"
          />
        </header>
        <main id="main-content" class="page-canvas" tabindex="-1">
          <Show when={!sessionLoading()} fallback={<p role="status">正在核实登录会话…</p>}>
            <Show when={sessionFailure()}>
              <p role="alert">
                登录会话核实失败：{sessionFailure()}{" "}
                <button class="text-button" onClick={() => retrySession()}>
                  重试登录验证
                </button>
              </p>
            </Show>
            <Show when={sessionUser() || location.pathname === "/login"}>{props.children}</Show>
          </Show>
        </main>
      </div>
    </div>
  );
};
