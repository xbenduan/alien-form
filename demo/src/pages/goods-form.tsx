import React from "react";
import { Card, Button, Space, message, Divider, Form, Typography } from "antd";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  useFormSubmit,
} from "@alien-form/react";
import { Input, Textarea, NumberInput, Select, Switch, DateInput, Rate, ArrayCards, FormItem } from "@/adapters";
import { goodsFormSchema } from "@/schema";
import { handlers } from "@/handlers";
import { createGoods, updateGoods, getGoodsById } from "@/mock";

const { Title } = Typography;

const components = { Input, Textarea, NumberInput, Select, Switch, DateInput, Rate, ArrayCards };
const decorators = { FormItem };

interface GoodsFormProps {
  mode: "create" | "edit";
  id?: string;
  onBack: () => void;
}

export const GoodsForm: React.FC<GoodsFormProps> = ({ mode, id, onBack }) => {
  const existingData = mode === "edit" && id ? getGoodsById(id) : undefined;

  const form = useCreateForm({
    initialValues: existingData || { status: "draft", specs: [] },
    handlers,
  });

  return (
    <Card>
      <Title level={4} className="!mb-6">
        {mode === "create" ? "新增商品" : "编辑商品"}
      </Title>
      <Form layout="horizontal" labelCol={{ span: 4 }} wrapperCol={{ span: 16 }}>
        <FormProvider form={form} components={components} decorators={decorators}>
          <SchemaField schema={goodsFormSchema} />
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
        createGoods(values as any);
        message.success("商品创建成功");
      } else if (id) {
        updateGoods(id, values as any);
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
