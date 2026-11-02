import { Dialog } from "@kobalte/core/dialog";
import type { Component, JSX } from "solid-js";
import { Icon } from "./icons";

type WindowProps = {
  open: boolean;
  label: string;
  onClose: () => void;
  children?: JSX.Element;
  restoreFocus?: boolean;
};

/**
 * 用统一遮罩、关闭按钮和键盘交互承载浮层窗口。
 * @param props.restoreFocus 由 Formwork Host 管理焦点时设为 false，普通组件默认由 Dialog 恢复焦点。
 */
export const OverlayWindow: Component<WindowProps & { presentation?: "modal" | "drawer" }> = (
  props,
) => (
  <Dialog
    open={props.open}
    onOpenChange={(open) => {
      if (!open) props.onClose();
    }}
  >
    <Dialog.Portal>
      <Dialog.Overlay class="window-overlay" />
      <Dialog.Content
        class={`window-content ${props.presentation ?? "modal"}`}
        onCloseAutoFocus={(event) => {
          if (props.restoreFocus === false) event.preventDefault();
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
