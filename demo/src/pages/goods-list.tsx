import React, { useState, useCallback } from "react";
import { Card, Button, Table, Tag, Space, Popconfirm, message, Tabs, Image } from "antd";
import { PlusOutlined, EditOutlined, EyeOutlined, DeleteOutlined } from "@ant-design/icons";
import { getGoodsByStatus, deleteGoods, type GoodsItem, type GoodsStatus } from "@/mock";
import type { PageView } from "@/App";

const STATUS_CONFIG: Record<GoodsStatus, { label: string; color: string }> = {
  active: { label: "生效中", color: "green" },
  reviewing: { label: "审核中", color: "orange" },
  draft: { label: "草稿", color: "default" },
  offline: { label: "已下架", color: "red" },
};

interface GoodsListProps {
  onNavigate: (view: PageView) => void;
}

export const GoodsList: React.FC<GoodsListProps> = ({ onNavigate }) => {
  const [statusFilter, setStatusFilter] = useState<GoodsStatus | "all">("all");
  const [refreshKey, setRefreshKey] = useState(0);

  const data = getGoodsByStatus(statusFilter);

  const handleDelete = useCallback((id: string) => {
    deleteGoods(id);
    message.success("删除成功");
    setRefreshKey((k) => k + 1);
  }, []);

  const columns = [
    {
      title: "商品",
      key: "goods",
      render: (_: any, record: GoodsItem) => (
        <div className="flex items-center gap-3">
          <Image
            src={record.cover}
            width={48}
            height={48}
            className="rounded-md object-cover"
            fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiIGZvbnQtc2l6ZT0iMTAiPuaXoOWbvjwvdGV4dD48L3N2Zz4="
            preview={false}
          />
          <div>
            <div className="font-medium text-gray-800">{record.name}</div>
            <div className="text-xs text-gray-400">{record.category}</div>
          </div>
        </div>
      ),
    },
    {
      title: "售价",
      dataIndex: "price",
      key: "price",
      render: (price: number) => <span className="font-medium text-red-500">¥{price.toFixed(2)}</span>,
      width: 120,
    },
    {
      title: "库存",
      dataIndex: "stock",
      key: "stock",
      width: 80,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: GoodsStatus) => {
        const config = STATUS_CONFIG[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 160,
      render: (t: string) => new Date(t).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "action",
      width: 180,
      render: (_: any, record: GoodsItem) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onNavigate({ type: "detail", id: record.id })}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onNavigate({ type: "edit", id: record.id })}>
            编辑
          </Button>
          <Popconfirm title="确定删除该商品？" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    { key: "all", label: `全部 (${getGoodsByStatus("all").length})` },
    { key: "active", label: `生效中 (${getGoodsByStatus("active").length})` },
    { key: "reviewing", label: `审核中 (${getGoodsByStatus("reviewing").length})` },
    { key: "draft", label: `草稿 (${getGoodsByStatus("draft").length})` },
    { key: "offline", label: `已下架 (${getGoodsByStatus("offline").length})` },
  ];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <Tabs
          activeKey={statusFilter}
          onChange={(key) => setStatusFilter(key as GoodsStatus | "all")}
          items={tabItems}
          className="!mb-0"
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => onNavigate({ type: "create" })}>
          新增商品
        </Button>
      </div>
      <Table
        key={refreshKey}
        dataSource={data}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: "暂无商品数据" }}
      />
    </Card>
  );
};
