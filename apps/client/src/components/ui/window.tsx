import { Dialog } from "@kobalte/core/dialog";
import type { Component, JSX } from "solid-js";
import { Icon } from "../../formwork/shell/icons";

type WindowProps = {
  open: boolean;
  label: string;
  onClose: () => void;
  children?: JSX.Element;
  restoreFocus?: boolean;
  returnFocus?: HTMLElement;
  portalTarget?: HTMLElement;
};

/**
 * 用统一遮罩、关闭按钮和键盘交互承载浮层窗口。
 * @param props.portalTarget 限定 Portal 挂载位置，继承当前应用的样式变量。
 * @param props.returnFocus 没有 Dialog.Trigger 的普通弹层在关闭后恢复焦点的目标。
 */
export const OverlayWindow: Component<WindowProps & { presentation?: "modal" | "drawer" }> = (
  props,
) => {
  const trigger =
    document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  const target = () =>
    props.portalTarget ?? trigger?.closest<HTMLElement>("[data-formwork-root]") ?? undefined;
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <Dialog.Portal mount={target()}>
        <Dialog.Overlay class="window-overlay" />
        <Dialog.Content
          class={`window-content ${props.presentation ?? "modal"}`}
          onCloseAutoFocus={(event) => {
            if (props.restoreFocus === false) event.preventDefault();
            else if ((props.returnFocus ?? trigger)?.isConnected) {
              event.preventDefault();
              (props.returnFocus ?? trigger)?.focus();
            }
          }}
        >
          <div class="window-heading">
            <Dialog.Title class="sr-only">{props.label}</Dialog.Title>
            <Dialog.CloseButton class="icon-button" aria-label="关闭窗口">
              <Icon name="close" />
            </Dialog.CloseButton>
          </div>
          {props.children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

/**
 * 在画布中央显示圆角 Modal，共享窗口关闭和焦点管理。
 * @example <Modal open={visible()} label="编辑" onClose={() => setVisible(false)}>{content}</Modal>
 */
export const Modal: Component<WindowProps> = (props) => (
  <OverlayWindow {...props} presentation="modal" />
);

/**
 * 在右侧显示四周留有边距的圆角 Drawer，共享窗口关闭和焦点管理。
 * @example <Drawer open={visible()} label="详情" onClose={() => setVisible(false)}>{content}</Drawer>
 */
export const Drawer: Component<WindowProps> = (props) => (
  <OverlayWindow {...props} presentation="drawer" />
);
