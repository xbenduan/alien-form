import { Dialog } from "@kobalte/core/dialog";
import { useLocation } from "@solidjs/router";
import { Show } from "solid-js";
import type { Component } from "solid-js";
import type { PresenterProps } from "formwork";
import { AppShell } from "./app-shell";
import { Icon } from "./icons";

const embeddedPreview = window.location.pathname.startsWith("/model-preview/");

/** 以独立登录页、嵌入预览或管理端画布承载完整 Page。 */
export const PagePresenter: Component<PresenterProps> = (props) => {
  const loginPage = useLocation().pathname === "/login";
  return (
    <Show
      when={!embeddedPreview && !loginPage}
      fallback={
        <main class={loginPage ? "auth-layout" : "page-canvas embedded-canvas"}>
          {props.children}
        </main>
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay class="window-overlay" />
        <Dialog.Content
          class={props.drawer ? "window-content drawer" : "window-content modal"}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <div class="window-heading">
            <Dialog.Title class="sr-only">{props.drawer ? "记录详情" : "编辑记录"}</Dialog.Title>
            <Dialog.CloseButton class="icon-button" aria-label="关闭窗口">
              <Icon name="close" />
            </Dialog.CloseButton>
          </div>
          {props.children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  </>
);
/** 使用 Kobalte 管理 Modal 的焦点、Esc 和关闭动作。 */
export const ModalPresenter: Component<PresenterProps> = (props) => <Overlay {...props} />;
/** 使用同一完整内容挂载流程呈现 Drawer。 */
export const DrawerPresenter: Component<PresenterProps> = (props) => <Overlay {...props} drawer />;
