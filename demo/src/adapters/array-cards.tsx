import React from "react";
import { Card, Button, Space, Empty } from "antd";
import { PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";

interface ArrayCardsProps {
  rows: React.ReactNode[][];
  rowFields: Record<string, React.ReactNode>[];
  onAdd: (iv?: any) => void;
  onRemove: (i: number) => void;
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
  disabled?: boolean;
  addText?: string;
  field?: any;
}

export const ArrayCards: React.FC<ArrayCardsProps> = ({
  rows,
  onAdd,
  onRemove,
  onMoveUp,
  onMoveDown,
  disabled,
  addText = "+ 添加",
}) => {
  if (rows.length === 0) {
    return (
      <div>
        <Empty description="暂无数据" className="py-5" />
        {!disabled && (
          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => onAdd()}>
            {addText}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <Card
          key={index}
          size="small"
          title={<span className="text-sm font-medium">#{index + 1}</span>}
          extra={
            !disabled && (
              <Space size="small">
                <Button type="text" size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => onMoveUp(index)} />
                <Button type="text" size="small" icon={<ArrowDownOutlined />} disabled={index === rows.length - 1} onClick={() => onMoveDown(index)} />
                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onRemove(index)} />
              </Space>
            )
          }
        >
          {row}
        </Card>
      ))}
      {!disabled && (
        <Button type="dashed" block icon={<PlusOutlined />} onClick={() => onAdd()}>
          {addText}
        </Button>
      )}
    </div>
  );
};
