import { Drawer, Modal } from "antd";
import type { ReactNode } from "react";
import type { ComponentProps } from "@alien-form/react";

type OpenMode = "page" | "modal" | "drawer";

export function Overlay({
  open = true,
  title,
  width = 720,
  mode = "drawer",
  onClose,
  footer,
  children,
}: Partial<ComponentProps> & {
  open?: boolean;
  title?: ReactNode;
  width?: number;
  mode?: Exclude<OpenMode, "page">;
  onClose?: () => void;
  footer?: ReactNode;
}) {
  if (mode === "modal") {
    return (
      <Modal
        centered
        destroyOnHidden
        footer={footer}
        open={open}
        title={title}
        width={width}
        onCancel={onClose}
      >
        {children}
      </Modal>
    );
  }
  return (
    <Drawer
      destroyOnHidden
      open={open}
      title={title}
      width={width}
      footer={footer ? <div className="flex justify-end">{footer}</div> : undefined}
      onClose={onClose}
    >
      {children}
    </Drawer>
  );
}
