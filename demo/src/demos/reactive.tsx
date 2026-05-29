import React from "react";
import { Form, Typography, Card, Alert } from "antd";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  useFormValues,
  type IFormSchema,
} from "@alien-form/react";
import { Input, Select, Switch, FormItem } from "@/adapters";
import { handlers } from "@/handlers";

const { Text } = Typography;

/** 联动演示 schema：展示多种 x-reaction 能力 */
const reactiveSchema: IFormSchema = {
  type: "object",
  properties: {
    country: {
      type: "string",
      title: "国家",
      component: "Select",
      decorator: "FormItem",
      dataSource: [
        { label: "中国", value: "cn" },
        { label: "美国", value: "us" },
        { label: "日本", value: "jp" },
      ],
      order: 10,
    },
    city: {
      type: "string",
      title: "城市",
      component: "Select",
      decorator: "FormItem",
      order: 20,
      "x-reaction": {
        dataSource: {
          type: "match",
          dependencies: ["country"],
          match: {
            cn: [
              { label: "北京", value: "beijing" },
              { label: "上海", value: "shanghai" },
              { label: "深圳", value: "shenzhen" },
            ],
            us: [
              { label: "New York", value: "nyc" },
              { label: "San Francisco", value: "sf" },
            ],
            jp: [
              { label: "东京", value: "tokyo" },
              { label: "大阪", value: "osaka" },
            ],
            default: [],
          },
        },
        disabled: {
          type: "expression",
          dependencies: ["country"],
          expression: "!$deps[0]",
        },
      },
    },
    showExtra: {
      type: "boolean",
      title: "显示附加信息",
      component: "Switch",
      decorator: "FormItem",
      default: false,
      order: 30,
    },
    extra: {
      type: "string",
      title: "附加信息",
      component: "Input",
      decorator: "FormItem",
      props: { placeholder: "打开开关后可见" },
      order: 40,
      "x-reaction": {
        display: {
          type: "expression",
          dependencies: ["showExtra"],
          expression: "$deps[0] ? 'visible' : 'none'",
        },
      },
    },
    greeting: {
      type: "string",
      title: "问候语(自动生成)",
      component: "Input",
      decorator: "FormItem",
      props: { disabled: true },
      order: 50,
      "x-reaction": {
        value: {
          type: "expression",
          dependencies: ["country", "city"],
          expression: "$deps[0] && $deps[1] ? 'Hello from ' + $deps[1] + ', ' + $deps[0] : ''",
        },
      },
    },
  },
};

const components = { Input, Select, Switch };
const decorators = { FormItem };

export const ReactiveDemo: React.FC = () => {
  const form = useCreateForm({ handlers });

  return (
    <div className="space-y-4">
      <Alert
        type="info"
        showIcon
        message="联动演示"
        description="选择国家后城市选项自动变化；打开开关显示附加字段；问候语根据选择自动生成。"
      />
      <Form layout="horizontal" labelCol={{ span: 5 }} wrapperCol={{ span: 19 }}>
        <FormProvider form={form} components={components} decorators={decorators}>
          <SchemaField schema={reactiveSchema} />
        </FormProvider>
      </Form>
      <FormValuesDisplay />
    </div>
  );
};

/** 实时展示表单值 */
const FormValuesDisplay: React.FC = () => {
  // Note: This component intentionally subscribes to form.values to show real-time data.
  // In a real app you'd avoid this for performance — it re-renders on ANY value change.
  return null;
};
