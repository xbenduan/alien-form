import { Drawer, Modal } from "antd";
import type { ReactNode } from "react";
import type { ComponentProps } from "@binding";
import type { OpenMode } from "@engine";
import styles from "./index.module.css";

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
      footer={footer ? <div className={styles.overlayFooter}>{footer}</div> : undefined}
      onClose={onClose}
    >
      {children}
    </Drawer>
  );
}
