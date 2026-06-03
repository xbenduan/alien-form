import type React from "react";
import { defineAdapter } from "@alien-form/cms";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Button, Card, Empty, Space } from "antd";

interface ArrayCardsProps {
  rows: React.ReactNode[];
  onAdd: (initialValues?: unknown) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  disabled?: boolean;
  addText?: string;
}

function ArrayCards({
  rows,
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
  disabled,
  addText = "+ 添加",
}: ArrayCardsProps) {
  if (rows.length === 0) {
    return (
      <div>
        <Empty description="暂无数据" style={{ paddingBlock: 20 }} />
        {!disabled ? (
          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => onAdd()}>
            {addText}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {rows.map((row, index) => (
        <Card
          key={index}
          size="small"
          title={<span style={{ fontSize: 13, fontWeight: 600 }}>#{index + 1}</span>}
          extra={
            !disabled ? (
              <Space size="small">
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowUpOutlined />}
                  disabled={index === 0}
                  onClick={() => onMoveUp(index)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowDownOutlined />}
                  disabled={index === rows.length - 1}
                  onClick={() => onMoveDown(index)}
                />
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onRemove(index)}
                />
              </Space>
            ) : null
          }
        >
          {row}
        </Card>
      ))}
      {!disabled ? (
        <Button type="dashed" block icon={<PlusOutlined />} onClick={() => onAdd()}>
          {addText}
        </Button>
      ) : null}
    </div>
  );
}

export default defineAdapter({
  component: ArrayCards,
  config: {
    key: "ArrayCards",
    label: "ArrayCards",
    description: "对象数组卡片编辑组件。",
    kind: "component",
    scenes: ["recordForm", "recordDetail"],
    meta: { fieldType: "array" },
  },
});
