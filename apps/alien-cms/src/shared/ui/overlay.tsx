import * as RadixDialog from "@radix-ui/react-dialog";
import type { CSSProperties, ReactNode } from "react";
import { Button, type ButtonProps } from "./button";
import { cn } from "./cn";
import { Space } from "./typography";

function toPixel(value?: number | string) {
  if (typeof value === "number") return `${value}px`;
  return value;
}

function CloseButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label="关闭"
      className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[rgba(80,63,50,0.65)] transition hover:bg-[rgba(201,100,66,0.08)] hover:text-[#A24E31]"
      onClick={onClick}
    >
      ×
    </button>
  );
}

const overlayClass =
  "fixed inset-0 z-[1000] bg-[rgba(46,37,30,0.24)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0";

export function Modal({
  open,
  title,
  children,
  footer,
  width = 640,
  centered,
  onCancel,
  onOk,
  okText = "确定",
  cancelText = "取消",
  okButtonProps,
  cancelButtonProps,
  confirmLoading,
  maskClosable = true,
}: {
  open?: boolean;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode | null;
  width?: number | string;
  centered?: boolean;
  onCancel?: () => void;
  onOk?: () => void;
  okText?: ReactNode;
  cancelText?: ReactNode;
  okButtonProps?: ButtonProps;
  cancelButtonProps?: ButtonProps;
  confirmLoading?: boolean;
  destroyOnHidden?: boolean;
  destroyOnClose?: boolean;
  maskClosable?: boolean;
}) {
  const resolvedFooter =
    footer !== undefined ? (
      footer
    ) : (
      <Space size={8}>
        {(cancelButtonProps?.style as CSSProperties | undefined)?.display === "none" ? null : (
          <Button onClick={onCancel} {...cancelButtonProps}>
            {cancelText}
          </Button>
        )}
        <Button type="primary" loading={confirmLoading} onClick={onOk} {...okButtonProps}>
          {okText}
        </Button>
      </Space>
    );

  return (
    <RadixDialog.Root
      open={!!open}
      onOpenChange={(value) => {
        if (!value) onCancel?.();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={overlayClass}
          onClick={(event) => {
            if (!maskClosable) {
              event.preventDefault();
            }
          }}
        />
        <RadixDialog.Content
          onPointerDownOutside={(event) => {
            if (!maskClosable) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (!maskClosable) event.preventDefault();
          }}
          className={cn(
            "fixed left-1/2 top-12 z-[1001] -translate-x-1/2 rounded-[16px] border border-[rgba(120,98,79,0.16)] bg-[rgba(252,248,242,0.98)] shadow-[0_18px_42px_rgba(68,49,33,0.18)] outline-none",
            "max-w-[calc(100vw-2rem)]",
            centered && "top-1/2 -translate-y-1/2",
          )}
          style={{ width: toPixel(width) }}
        >
          <div className="ant-modal">
            <div className="ant-modal-content">
              <div className="ant-modal-header flex items-center justify-between gap-3 border-b border-[rgba(120,98,79,0.12)] px-5 py-4">
                <RadixDialog.Title className="ant-modal-title font-serif text-lg text-[#2E251E]">
                  {title}
                </RadixDialog.Title>
                <RadixDialog.Close asChild>
                  <CloseButton onClick={onCancel} />
                </RadixDialog.Close>
              </div>
              <div className="ant-modal-body max-h-[70vh] overflow-auto px-5 py-4">{children}</div>
              {resolvedFooter !== null ? (
                <div className="ant-modal-footer flex justify-end border-t border-[rgba(120,98,79,0.12)] px-5 py-3">
                  {resolvedFooter}
                </div>
              ) : null}
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export function Drawer({
  open,
  title,
  children,
  footer,
  width = 520,
  onClose,
  maskClosable = true,
}: {
  open?: boolean;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode | null;
  width?: number | string;
  onClose?: () => void;
  destroyOnHidden?: boolean;
  maskClosable?: boolean;
}) {
  return (
    <RadixDialog.Root
      open={!!open}
      onOpenChange={(value) => {
        if (!value) onClose?.();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={overlayClass} />
        <RadixDialog.Content
          onPointerDownOutside={(event) => {
            if (!maskClosable) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (!maskClosable) event.preventDefault();
          }}
          className={cn(
            "ant-drawer fixed right-0 top-0 z-[1001] h-full border-l border-[rgba(120,98,79,0.12)] bg-[rgba(252,248,242,0.98)] shadow-[-18px_0_44px_rgba(68,49,33,0.16)] outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          )}
          style={{ width: toPixel(width), maxWidth: "calc(100vw - 24px)" }}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-[rgba(120,98,79,0.12)] px-5 py-4">
              <RadixDialog.Title className="font-serif text-lg text-[#2E251E]">
                {title}
              </RadixDialog.Title>
              <RadixDialog.Close asChild>
                <CloseButton onClick={onClose} />
              </RadixDialog.Close>
            </div>
            <div className="flex-1 overflow-auto px-5 py-4">{children}</div>
            {footer !== null && footer !== undefined ? (
              <div className="border-t border-[rgba(120,98,79,0.12)] px-5 py-3">{footer}</div>
            ) : null}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
