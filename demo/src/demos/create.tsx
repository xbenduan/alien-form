import React from "react";
import { Button, Space, message, Divider, Form } from "antd";
import { FormProvider, SchemaField, useCreateForm, useFormSubmit } from "@alien-form/react";
import { Input, Textarea, Select, Switch, DateInput, Rate, ArrayCards, FormItem } from "@/adapters";
import { employeeSchema } from "@/schema";
import { handlers } from "@/handlers";

const components = { Input, Textarea, Select, Switch, DateInput, Rate, ArrayCards };
const decorators = { FormItem };

export const CreateDemo: React.FC = () => {
  const form = useCreateForm({ handlers });

  return (
    <Form layout="horizontal" labelCol={{ span: 5 }} wrapperCol={{ span: 19 }}>
      <FormProvider form={form} components={components} decorators={decorators}>
        <SchemaField schema={employeeSchema} />
        <Divider />
        <SubmitBar />
      </FormProvider>
    </Form>
  );
};

const SubmitBar: React.FC = () => {
  const { submit, submitting } = useFormSubmit();
  return (
    <div className="text-center">
      <Space>
        <Button
          type="primary"
          loading={submitting}
          onClick={async () => {
            try {
              const values = await submit();
              message.success("提交成功");
              console.log("values:", values);
            } catch (err: any) {
              message.error(err.messages?.join(", ") || "校验失败");
            }
          }}
        >
          提交
        </Button>
      </Space>
    </div>
  );
};
