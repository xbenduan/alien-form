import React from "react";
import { Table, InputNumber, Switch, Empty, Typography } from "antd";

const { Text } = Typography;

interface SkuTableProps {
  value?: Array<{
    specAttrs: Record<string, string>;
    price: number;
    stock: number;
    status: 0 | 1;
  }>;
  onChange?: (v: any[]) => void;
  disabled?: boolean;
  field?: any;
  rows?: any;
  rowFields?: any;
  onAdd?: any;
  onRemove?: any;
  onMoveUp?: any;
  onMoveDown?: any;
}

export const SkuTable: React.FC<SkuTableProps> = ({ value = [], onChange, disabled }) => {
  if (!value || value.length === 0) {
    return <Empty description="请先添加规格，系统将自动生成 SKU 组合" className="py-6" />;
  }

  // Collect spec column names from first SKU
  const specKeys = Object.keys(value[0]?.specAttrs || {});

  const handleChange = (index: number, field: string, val: any) => {
    const newData = [...value];
    newData[index] = { ...newData[index], [field]: val };
    onChange?.(newData);
  };

  const columns = [
    ...specKeys.map((key) => ({
      title: key,
      key: `spec_${key}`,
      render: (_: any, record: any) => (
        <Text>{record.specAttrs[key]}</Text>
      ),
      width: 100,
    })),
    {
      title: "售价 (¥)",
      key: "price",
      width: 130,
      render: (_: any, record: any, index: number) =>
        disabled ? (
          <Text>¥{record.price}</Text>
        ) : (
          <InputNumber
            value={record.price}
            min={0}
            onChange={(v) => handleChange(index, "price", v ?? 0)}
            className="w-full"
            size="small"
          />
        ),
    },
    {
      title: "库存",
      key: "stock",
      width: 110,
      render: (_: any, record: any, index: number) =>
        disabled ? (
          <Text>{record.stock}</Text>
        ) : (
          <InputNumber
            value={record.stock}
            min={0}
            onChange={(v) => handleChange(index, "stock", v ?? 0)}
            className="w-full"
            size="small"
          />
        ),
    },
    {
      title: "售卖中",
      key: "status",
      width: 80,
      render: (_: any, record: any, index: number) =>
        disabled ? (
          <Text>{record.status === 1 ? "是" : "否"}</Text>
        ) : (
          <Switch
            checked={record.status === 1}
            onChange={(checked) => handleChange(index, "status", checked ? 1 : 0)}
            size="small"
          />
        ),
    },
  ];

  return (
    <Table
      dataSource={value}
      columns={columns}
      rowKey={(_, i) => String(i)}
      pagination={false}
      size="small"
      bordered
      scroll={{ x: "max-content" }}
    />
  );
};
