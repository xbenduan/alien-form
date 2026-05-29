import React, { useEffect, useState } from "react";
import { Card, Button, Space, message, Divider, Form, Typography, Spin } from "antd";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  useFormSubmit,
  type IFormSchema,
} from "@alien-form/react";
import { Input, Textarea, NumberInput, Select, Switch, DateInput, Rate, ArrayCards, FormItem } from "@/adapters";
import { handlers } from "@/handlers";
import { createGoods, updateGoods, fetchGoodsById, fetchGoodsSchema } from "@/mock";

const { Title } = Typography;

const components = { Input, Textarea, NumberInput, Select, Switch, DateInput, Rate, ArrayCards };
const decorators = { FormItem };

interface GoodsFormProps {
  mode: "create" | "edit";
  id?: string;
  onBack: () => void;
}

export const GoodsForm: React.FC<GoodsFormProps> = ({ mode, id, onBack }) => {
  const [schema, setSchema] = useState<IFormSchema | null>(null);
  const [initialData, setInitialData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const schemaData = await fetchGoodsSchema();
      setSchema(schemaData);

      if (mode === "edit" && id) {
        const item = await fetchGoodsById(id);
        setInitialData(item || { status: "draft", specs: [] });
      } else {
        setInitialData({ status: "draft", specs: [] });
      }
      setLoading(false);
    };
    load();
  }, [mode, id]);

  if (loading || !schema || !initialData) {
    return (
      <Card>
        <Spin tip="加载中..." className="block py-20 text-center" />
      </Card>
    );
  }

  return <GoodsFormInner mode={mode} id={id} schema={schema} initialData={initialData} onBack={onBack} />;
};

const GoodsFormInner: React.FC<{
  mode: "create" | "edit";
  id?: string;
  schema: IFormSchema;
  initialData: Record<string, any>;
  onBack: () => void;
}> = ({ mode, id, schema, initialData, onBack }) => {
  const form = useCreateForm({ initialValues: initialData, handlers });

  return (
    <Card>
      <Title level={4} className="!mb-6">
        {mode === "create" ? "新增商品" : "编辑商品"}
      </Title>
      <Form layout="horizontal" labelCol={{ span: 4 }} wrapperCol={{ span: 16 }}>
        <FormProvider form={form} components={components} decorators={decorators}>
          <SchemaField schema={schema} />
          <Divider />
          <SubmitBar mode={mode} id={id} onBack={onBack} />
        </FormProvider>
      </Form>
    </Card>
  );
};

const SubmitBar: React.FC<{ mode: "create" | "edit"; id?: string; onBack: () => void }> = ({
  mode,
  id,
  onBack,
}) => {
  const { submit, submitting } = useFormSubmit();

  const handleSubmit = async () => {
    try {
      const values = await submit();
      if (mode === "create") {
        await createGoods(values as any);
        message.success("商品创建成功");
      } else if (id) {
        await updateGoods(id, values as any);
        message.success("商品更新成功");
      }
      onBack();
    } catch (err: any) {
      message.error(err.messages?.join("; ") || "表单校验失败，请检查");
    }
  };

  return (
    <div className="text-center">
      <Space size="middle">
        <Button onClick={onBack}>取消</Button>
        <Button type="primary" loading={submitting} onClick={handleSubmit}>
          {mode === "create" ? "创建商品" : "保存修改"}
        </Button>
      </Space>
    </div>
  );
};
