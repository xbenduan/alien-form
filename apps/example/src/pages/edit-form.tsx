import React, { useEffect, useState } from "react";
import { Button, Space, message, Divider, Spin } from "antd";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  useFormSubmit,
} from "@alien-form/react";
import { Input, Textarea, Select, Switch, DateInput, Rate } from "@/components/antd-components";
import { FormItem } from "@/components/antd-decorator";
import { ArrayCards } from "@/components/antd-array-cards";
import { employeeSchema, mockEmployeeData } from "@/schema";
import { handlers } from "@/handlers";

const components = { Input, Textarea, Select, Switch, DateInput, Rate, ArrayCards };
const decorators = { FormItem };

export const EditForm: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const form = useCreateForm({ initialValues: mockEmployeeData, handlers });

  useEffect(() => {
    // Simulate async data load
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <Spin tip="加载中..." style={{ display: "block", padding: 60, textAlign: "center" }} />;
  }

  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={employeeSchema} />
      <Divider />
      <EditSubmitBar />
    </FormProvider>
  );
};

const EditSubmitBar: React.FC = () => {
  const { submit, submitting } = useFormSubmit();

  return (
    <div style={{ textAlign: "center" }}>
      <Space>
        <Button
          type="primary"
          loading={submitting}
          onClick={async () => {
            try {
              const values = await submit();
              message.success("保存成功");
              console.log("Updated values:", values);
            } catch (err: any) {
              message.error(err.messages?.join(", ") || "校验失败");
            }
          }}
        >
          保存
        </Button>
      </Space>
    </div>
  );
};
