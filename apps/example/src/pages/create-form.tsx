import React, { useRef } from "react";
import { Button, Space, message, Divider, Typography } from "antd";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  useFormSubmit,
  useFormValidate,
} from "@alien-form/react";
import { Input, Textarea, Select, Switch, DateInput, Rate } from "@/components/antd-components";
import { FormItem } from "@/components/antd-decorator";
import { ArrayCards } from "@/components/antd-array-cards";
import { employeeSchema } from "@/schema";
import { handlers } from "@/handlers";

const { Text } = Typography;

const components = { Input, Textarea, Select, Switch, DateInput, Rate, ArrayCards };
const decorators = { FormItem };

export const CreateForm: React.FC = () => {
  const form = useCreateForm({ handlers });

  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={employeeSchema} />
      <Divider />
      <SubmitBar />
    </FormProvider>
  );
};

const SubmitBar: React.FC = () => {
  const { submit, submitting } = useFormSubmit();
  const { validate } = useFormValidate();

  return (
    <div style={{ textAlign: "center" }}>
      <Space>
        <Button
          type="primary"
          loading={submitting}
          onClick={async () => {
            try {
              const values = await submit();
              message.success("提交成功");
              console.log("Form values:", values);
            } catch (err: any) {
              message.error(err.messages?.join(", ") || "校验失败");
            }
          }}
        >
          提交
        </Button>
        <Button onClick={() => validate()}>仅校验</Button>
      </Space>
    </div>
  );
};
