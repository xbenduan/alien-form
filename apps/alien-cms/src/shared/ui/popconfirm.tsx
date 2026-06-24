import * as RadixPopover from "@radix-ui/react-popover";
import { useState, type ReactElement, type ReactNode } from "react";
import { Button, type ButtonProps } from "./button";
import { cn } from "./cn";

export function Popconfirm({
  children,
  title,
  description,
  okText = "确定",
  cancelText = "取消",
  okButtonProps,
  onConfirm,
}: {
  children: ReactElement;
  title?: ReactNode;
  description?: ReactNode;
  okText?: ReactNode;
  cancelText?: ReactNode;
  okButtonProps?: ButtonProps;
  onConfirm?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <RadixPopover.Root open={open} onOpenChange={setOpen}>
      <RadixPopover.Trigger asChild>{children}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          sideOffset={6}
          className={cn(
            "z-[1300] w-64 rounded-[12px] border border-[rgba(120,98,79,0.14)] bg-[rgba(255,251,246,0.98)] p-3 text-sm shadow-[0_14px_32px_rgba(68,49,33,0.16)] backdrop-blur outline-none",
          )}
        >
          <div className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] bg-[rgba(185,135,64,0.18)] text-xs text-[#8C642B]"
            >
              !
            </span>
            <div className="min-w-0 flex-1">
              {title ? (
                <div className="font-medium text-[var(--af-text,#2f261f)]">{title}</div>
              ) : null}
              {description ? (
                <div className="mt-1 text-xs text-[rgba(80,63,50,0.62)]">{description}</div>
              ) : null}
            </div>
          </div>
          <div className="mt-2.5 flex justify-end gap-1.5">
            <Button
              size="small"
              onClick={() => setOpen(false)}
            >
              {cancelText}
            </Button>
            <Button
              size="small"
              type="primary"
              loading={loading}
              {...okButtonProps}
              onClick={async () => {
                try {
                  setLoading(true);
                  await onConfirm?.();
                  setOpen(false);
                } finally {
                  setLoading(false);
                }
              }}
            >
              {okText}
            </Button>
          </div>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
