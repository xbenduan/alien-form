import { A, useLocation } from "@solidjs/router";
import { For } from "solid-js";
import type { Component, JSX } from "solid-js";
import { modelSourceName } from "../models";
import { BrandMark, Icon } from "./icons";

const navigation = [
  { href: "/models", title: "模型工作台", icon: "model" },
  { href: "/list/orders", title: "订单管理", icon: "orders" },
  { href: "/list/cms", title: "内容管理", icon: "content" },
] as const;

/** 为所有页面提供统一导航、当前位置和模型源提示。 */
export const AppShell: Component<{ children?: JSX.Element }> = (props) => {
  const location = useLocation();
  const current = () => {
    if (location.pathname.startsWith("/models")) return navigation[0];
    if (location.pathname.includes("/orders")) return navigation[1];
    if (location.pathname.includes("/cms")) return navigation[2];
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
            <span class="source-indicator">
              <Icon name="code" />
              模型源：{modelSourceName === "remote" ? "远端" : "本地"}
            </span>
          </div>
        </header>
        <main id="main-content" class="page-canvas" tabindex="-1">
          {props.children}
        </main>
      </div>
    </div>
  );
};
