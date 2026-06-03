import { Checkbox, Modal, Space } from "antd";

interface ColumnVisibilityModalProps {
  open: boolean;
  options: Array<{ label: string; value: string }>;
  values: string[];
  onChange: (values: string[]) => void;
  onReset: () => void;
  onClose: () => void;
}

export function ColumnVisibilityModal({
  open,
  options,
  values,
  onChange,
  onReset,
  onClose,
}: ColumnVisibilityModalProps) {
  return (
    <Modal
      title="自定义列"
      open={open}
      okText="完成"
      cancelText="关闭"
      onOk={onClose}
      onCancel={onClose}
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Space>
          <a onClick={() => onChange(options.map((item) => item.value))}>全选</a>
          <a onClick={() => onChange([])}>清空</a>
          <a onClick={onReset}>恢复默认</a>
        </Space>
        <Checkbox.Group
          style={{ width: "100%" }}
          value={values}
          onChange={(nextValues) => onChange(nextValues as string[])}
        >
          <Space orientation="vertical" size={12} style={{ width: "100%" }}>
            {options.map((option) => (
              <Checkbox key={option.value} value={option.value}>
                {option.label}
              </Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
      </Space>
    </Modal>
  );
}
