import React from "react";
import { Card, Descriptions, Tag, Image, Typography, Button, Empty, Divider } from "antd";
import { getGoodsById, type GoodsStatus } from "@/mock";

const { Title, Paragraph } = Typography;

const STATUS_MAP: Record<GoodsStatus, { label: string; color: string }> = {
  active: { label: "生效中", color: "green" },
  reviewing: { label: "审核中", color: "orange" },
  draft: { label: "草稿", color: "default" },
  offline: { label: "已下架", color: "red" },
};

const CATEGORY_MAP: Record<string, string> = {
  electronics: "数码电子",
  clothing: "服饰鞋包",
  home: "家居生活",
  food: "食品饮料",
  beauty: "美妆个护",
};

interface GoodsDetailProps {
  id: string;
  onBack: () => void;
}

export const GoodsDetail: React.FC<GoodsDetailProps> = ({ id, onBack }) => {
  const item = getGoodsById(id);

  if (!item) {
    return (
      <Card>
        <Empty description="商品不存在" />
        <div className="text-center mt-4">
          <Button onClick={onBack}>返回列表</Button>
        </div>
      </Card>
    );
  }

  const statusConfig = STATUS_MAP[item.status];

  return (
    <Card>
      <div className="flex items-start gap-6 mb-6">
        <Image
          src={item.cover}
          width={160}
          height={160}
          className="rounded-lg object-cover"
          fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5IiBmb250LXNpemU9IjE0Ij7ml6Dlm748L3RleHQ+PC9zdmc+"
        />
        <div className="flex-1">
          <Title level={4} className="!mb-2">{item.name}</Title>
          <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
          <div className="mt-3 text-2xl font-bold text-red-500">¥{item.price.toFixed(2)}</div>
        </div>
      </div>

      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="商品 ID">{item.id}</Descriptions.Item>
        <Descriptions.Item label="分类">{CATEGORY_MAP[item.category] || item.category}</Descriptions.Item>
        <Descriptions.Item label="库存">{item.stock}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">{new Date(item.createdAt).toLocaleString("zh-CN")}</Descriptions.Item>
        <Descriptions.Item label="更新时间">{new Date(item.updatedAt).toLocaleString("zh-CN")}</Descriptions.Item>
      </Descriptions>

      {item.description && (
        <>
          <Divider orientation="left">商品描述</Divider>
          <Paragraph className="text-gray-600">{item.description}</Paragraph>
        </>
      )}

      {item.specs && item.specs.length > 0 && (
        <>
          <Divider orientation="left">规格参数</Divider>
          <Descriptions bordered column={2} size="small">
            {item.specs.map((spec, i) => (
              <Descriptions.Item key={i} label={spec.name}>{spec.value}</Descriptions.Item>
            ))}
          </Descriptions>
        </>
      )}

      <div className="text-center mt-6">
        <Button onClick={onBack}>返回列表</Button>
      </div>
    </Card>
  );
};
