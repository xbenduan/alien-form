import { Dialog } from "@kobalte/core/dialog";
import { Show } from "solid-js";
import type { Component } from "solid-js";
import type { PresenterProps } from "formwork";
import { AppShell } from "./app-shell";
import { Icon } from "./icons";

const embeddedPreview = new URLSearchParams(window.location.search).get("embedded") === "1";

/** 在应用画布中承载完整 Page 或 page Window。 */
export const PagePresenter: Component<PresenterProps> = (props) => {
  return (
    <Show
      when={!embeddedPreview}
      fallback={<main class="page-canvas embedded-canvas">{props.children}</main>}
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
