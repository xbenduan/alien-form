import { useLocation } from "@solidjs/router";
import { Show } from "solid-js";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { PresenterProps } from "formwork";
import { AppShell } from "./app-shell";
import { Icon } from "./icons";
import { Drawer, Modal } from "./window";

const embeddedPreview = window.location.pathname.startsWith("/model-preview/");

/** 以独立登录页、嵌入预览或管理端画布承载完整 Page。 */
export const PagePresenter: Component<PresenterProps> = (props) => {
  const loginPage = useLocation().pathname === "/login";
  return (
    <Show
      when={!embeddedPreview && !loginPage}
      fallback={
        <Show
          when={loginPage}
          fallback={
            <div class="embedded-layout">
              <main class="page-canvas embedded-canvas">{props.children}</main>
            </div>
          }
        >
          <main class="auth-layout">{props.children}</main>
        </Show>
      }
    >
      <AppShell>{props.children}</AppShell>
    </Show>
  );
};
const Overlay: Component<PresenterProps & { drawer?: boolean }> = (props) => (
  <>
    <Show when={props.direct && !embeddedPreview}>
      <AppShell>
        <div class="direct-window-background">
          <Icon name={props.drawer ? "preview" : "orders"} />
          <p>{props.drawer ? "查看记录详情" : "正在编辑记录"}</p>
        </div>
      </AppShell>
    </Show>
    <Dynamic
      component={props.drawer ? Drawer : Modal}
      open
      label={props.drawer ? "记录详情" : "编辑记录"}
      onClose={props.close}
      restoreFocus={false}
    >
      {props.children}
    </Dynamic>
  </>
);
/** 使用公共 Modal 呈现完整记录表单。 */
export const ModalPresenter: Component<PresenterProps> = (props) => <Overlay {...props} />;
/** 使用公共 Drawer 呈现完整记录详情。 */
export const DrawerPresenter: Component<PresenterProps> = (props) => <Overlay {...props} drawer />;
