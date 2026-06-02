import type { ReactNode } from 'react';
import { Card, Drawer, Modal } from 'antd';
import type { ModelActionOpenMode } from '../types/record';

interface RecordActionFrameProps {
  openMode: ModelActionOpenMode;
  open: boolean;
  title: string;
  drawerWidth: number;
  modalWidth: number;
  onClose: () => void;
  children: ReactNode;
}

export function RecordActionFrame({
  openMode,
  open,
  title,
  drawerWidth,
  modalWidth,
  onClose,
  children,
}: RecordActionFrameProps) {
  if (openMode === 'page') {
    return (
      <Card className="model-action-page" styles={{ body: { padding: 24 } }}>
        <div className="model-action-page-body">{children}</div>
      </Card>
    );
  }

  if (openMode === 'modal') {
    return (
      <Modal
        centered
        destroyOnHidden
        footer={null}
        title={title}
        open={open}
        width={modalWidth}
        onCancel={onClose}
      >
        {children}
      </Modal>
    );
  }

  return (
    <Drawer
      destroyOnHidden
      title={title}
      open={open}
      width={drawerWidth}
      onClose={onClose}
    >
      {children}
    </Drawer>
  );
}
