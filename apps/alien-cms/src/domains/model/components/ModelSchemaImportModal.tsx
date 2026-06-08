import { Input, Modal, Typography } from "antd";
import { useEffect, useState } from "react";

interface ModelSchemaImportModalProps {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (schemaText: string) => void;
}

export function ModelSchemaImportModal({
  open,
  submitting,
  onClose,
  onSubmit,
}: ModelSchemaImportModalProps) {
  const [schemaText, setSchemaText] = useState("");

  useEffect(() => {
    if (!open) {
      setSchemaText("");
    }
  }, [open]);

  return (
    <Modal
      title="解析 Schema"
      open={open}
      width={720}
      okText="导入并解析"
      cancelText="取消"
      okButtonProps={{ disabled: !schemaText.trim() }}
      confirmLoading={submitting}
      onCancel={onClose}
      onOk={() => onSubmit(schemaText)}
    >
      <Typography.Paragraph type="secondary">
        请粘贴完整的 Schema JSON。导入后会覆盖当前字段列表与 x-model 配置，并自动补齐系统字段。
      </Typography.Paragraph>
      <Input.TextArea
        autoSize={{ minRows: 14, maxRows: 22 }}
        value={schemaText}
        placeholder='例如 {"title":"商品","type":"object","properties":{...},"x-model":{...}}'
        onChange={(event) => setSchemaText(event.target.value)}
      />
    </Modal>
  );
}
