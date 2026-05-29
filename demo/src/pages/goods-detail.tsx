import React, { useEffect, useState } from "react";
import { Card, Button, Spin, Empty, Form, Typography, Tag } from "antd";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type IFormSchema,
  type ComponentMap,
  type DecoratorMap,
} from "@alien-form/react";
import { fetchGoodsById, fetchGoodsSchema, type GoodsItem, type GoodsStatus } from "@/mock";
import { handlers } from "@/handlers";

const { Title, Text } = Typography;

// ─── Read-only text components ────────────────────────────────────────────────

const TextView: React.FC<{ value?: any }> = ({ value }) => (
  <Text className="leading-8">{value ?? "-"}</Text>
);

const NumberView: React.FC<{ value?: number }> = ({ value }) => (
  <Text className="leading-8">{value != null ? String(value) : "-"}</Text>
);

const STATUS_LABELS: Record<GoodsStatus, { label: string; color: string }> = {
  active: { label: "生效中", color: "green" },
  reviewing: { label: "审核中", color: "orange" },
  draft: { label: "草稿", color: "default" },
  offline: { label: "已下架", color: "red" },
};

const CATEGORY_LABELS: Record<string, string> = {
  electronics: "数码电子",
  clothing: "服饰鞋包",
  home: "家居生活",
  food: "食品饮料",
  beauty: "美妆个护",
};

const SelectView: React.FC<{ value?: any; dataSource?: { label: string; value: any }[] }> = ({ value, dataSource = [] }) => {
  const item = dataSource.find((d) => d.value === value);
  // Special rendering for status field
  if (value && STATUS_LABELS[value as GoodsStatus]) {
    const config = STATUS_LABELS[value as GoodsStatus];
    return <Tag color={config.color}>{config.label}</Tag>;
  }
  return <Text className="leading-8">{item?.label ?? CATEGORY_LABELS[value] ?? value ?? "-"}</Text>;
};

const TextareaView: React.FC<{ value?: string }> = ({ value }) => (
  <Text className="leading-6 whitespace-pre-wrap">{value || "-"}</Text>
);

const ArrayView: React.FC<{ rows: React.ReactNode[][] }> = ({ rows }) => (
  <div className="flex flex-col gap-2">
    {rows.length === 0 && <Text type="secondary">暂无</Text>}
    {rows.map((row, i) => (
      <div key={i} className="rounded-md bg-gray-50 px-4 py-3 border border-gray-100">
        {row}
      </div>
    ))}
  </div>
);

// ─── Decorator for detail mode ────────────────────────────────────────────────

const DetailFormItem: React.FC<{
  label?: string;
  required?: boolean;
  errors?: any[];
  warnings?: any[];
  description?: string;
  validateStatus?: string;
  children?: React.ReactNode;
}> = ({ label, children }) => (
  <Form.Item label={label} className="!mb-3" labelCol={{ span: 4 }} wrapperCol={{ span: 16 }}>
    {children}
  </Form.Item>
);

// ─── Component/Decorator maps ─────────────────────────────────────────────────

const viewComponents: ComponentMap = {
  Input: TextView,
  Textarea: TextareaView,
  NumberInput: NumberView,
  Select: SelectView,
  Switch: ({ value }: { value?: boolean }) => <Tag color={value ? "green" : "default"}>{value ? "是" : "否"}</Tag>,
  DateInput: TextView,
  Rate: TextView,
  ArrayCards: ArrayView,
};

const viewDecorators: DecoratorMap = {
  FormItem: DetailFormItem,
};

// ─── Detail page ──────────────────────────────────────────────────────────────

interface GoodsDetailProps {
  id: string;
  onBack: () => void;
}

export const GoodsDetail: React.FC<GoodsDetailProps> = ({ id, onBack }) => {
  const [schema, setSchema] = useState<IFormSchema | null>(null);
  const [item, setItem] = useState<GoodsItem | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [schemaData, itemData] = await Promise.all([
        fetchGoodsSchema(),
        fetchGoodsById(id),
      ]);
      setSchema(schemaData);
      setItem(itemData);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <Card>
        <Spin tip="加载中..." className="block py-20 text-center" />
      </Card>
    );
  }

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

  return <GoodsDetailInner schema={schema!} item={item} onBack={onBack} />;
};

const GoodsDetailInner: React.FC<{
  schema: IFormSchema;
  item: GoodsItem;
  onBack: () => void;
}> = ({ schema, item, onBack }) => {
  const form = useCreateForm({ initialValues: item, handlers });

  return (
    <Card>
      <Title level={4} className="!mb-6">商品详情</Title>
      <Form layout="horizontal">
        <FormProvider form={form} components={viewComponents} decorators={viewDecorators}>
          <SchemaField schema={schema} />
        </FormProvider>
      </Form>
      <div className="text-center mt-6">
        <Button onClick={onBack}>返回列表</Button>
      </div>
    </Card>
  );
};
