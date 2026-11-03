import { Popover } from "@kobalte/core/popover";
import { createSignal, Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import { Message } from "./message";
import { Icon } from "../../formwork/shell/icons";

/**
 * 在触发器旁确认操作，支持外部锚点、异步提交、取消与焦点恢复。
 * @param props.anchor 无内置触发器时使用，例如 Formwork 的统一确认出口。
 * @param props.onConfirm 返回 false 时保留浮层，抛出的错误交给全局 Message。
 * @example <Popconfirm message="确定撤销吗？" onConfirm={revoke}>撤销</Popconfirm>
 */
export const Popconfirm: Component<{
  message: string;
  children?: JSX.Element;
  anchor?: HTMLElement;
  open?: boolean;
  onCancel?: () => void;
  onConfirm: () => unknown | Promise<unknown>;
  disabled?: boolean;
  confirmText?: string;
}> = (props) => {
  const [visible, setVisible] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  let trigger: HTMLButtonElement | undefined;
  let cancel: HTMLButtonElement | undefined;
  let restoreFocus = false;
  const anchor = () => props.anchor ?? trigger;
  const close = () => {
    if (busy()) return;
    setVisible(false);
    props.onCancel?.();
  };
  return (
    <Popover
      open={props.open ?? visible()}
      onOpenChange={(open) => (open ? setVisible(true) : close())}
      anchorRef={anchor}
      placement="bottom-end"
      gutter={8}
      fitViewport
      overflowPadding={12}
      modal={false}
    >
      <Show when={props.children}>
        <Popover.Trigger
          ref={(element) => {
            trigger = element;
          }}
          type="button"
          class="text-button danger"
          disabled={props.disabled || busy()}
        >
          {props.children}
        </Popover.Trigger>
      </Show>
      <Popover.Portal mount={anchor()?.closest<HTMLElement>("[data-formwork-root]") ?? undefined}>
        <Popover.Content
          class="popconfirm"
          aria-busy={busy()}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancel?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (busy()) event.preventDefault();
            else restoreFocus = true;
          }}
          onInteractOutside={(event) => {
            if (busy()) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (restoreFocus && anchor()?.isConnected) anchor()?.focus();
          }}
        >
          <Popover.Title class="sr-only">确认操作</Popover.Title>
          <div class="popconfirm-body">
            <Icon name="info" />
            <Popover.Description>{props.message}</Popover.Description>
          </div>
          <div class="actions">
            <button
              ref={(element) => {
                cancel = element;
              }}
              type="button"
              class="button secondary"
              disabled={busy()}
              onClick={() => {
                restoreFocus = true;
                close();
              }}
            >
              取消
            </button>
            <button
              type="button"
              class="button danger"
              disabled={busy()}
              onClick={async () => {
                if (busy()) return;
                restoreFocus = true;
                setBusy(true);
                try {
                  const result = await props.onConfirm();
                  if (result !== false) {
                    restoreFocus = true;
                    setVisible(false);
                  }
                } catch (error) {
                  Message.error(error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy() ? "正在处理…" : (props.confirmText ?? "确定")}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
};
