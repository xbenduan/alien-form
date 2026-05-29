import React from "react";
import { Button, Space, message, Divider, Form } from "antd";
import { FormProvider, SchemaField, useCreateForm, useFormSubmit } from "@alien-form/react";
import { Input, Textarea, Select, Switch, DateInput, Rate, ArrayCards, FormItem } from "@/adapters";
import { employeeSchema, mockData } from "@/schema";
import { handlers } from "@/handlers";

const components = { Input, Textarea, Select, Switch, DateInput, Rate, ArrayCards };
const decorators = { FormItem };

export const EditDemo: React.FC = () => {
  const form = useCreateForm({ initialValues: mockData, handlers });

  return (
    <Form layout="horizontal" labelCol={{ span: 5 }} wrapperCol={{ span: 19 }}>
      <FormProvider form={form} components={components} decorators={decorators}>
        <SchemaField schema={employeeSchema} />
        <Divider />
        <SaveBar />
      </FormProvider>
    </Form>
  );
};

const SaveBar: React.FC = () => {
  const { submit, submitting } = useFormSubmit();
  return (
    <div className="text-center">
      <Button
        type="primary"
        loading={submitting}
        onClick={async () => {
          try {
            const values = await submit();
            message.success("保存成功");
            console.log("saved:", values);
          } catch (err: any) {
            message.error(err.messages?.join(", ") || "校验失败");
          }
        }}
      >
        保存
      </Button>
    </div>
  );
};
