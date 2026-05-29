import React from "react";
import { Typography, Tag, Rate as AntRate, Form } from "antd";
import { FormProvider, SchemaField, useCreateForm, type ComponentMap, type DecoratorMap } from "@alien-form/react";
import { employeeSchema, mockData } from "@/schema";
import { handlers } from "@/handlers";

const { Text } = Typography;

const TextView: React.FC<{ value?: any }> = ({ value }) => <Text>{value ?? "-"}</Text>;
const SwitchView: React.FC<{ value?: boolean }> = ({ value }) => (
  <Tag color={value ? "green" : "default"}>{value ? "是" : "否"}</Tag>
);
const RateView: React.FC<{ value?: number }> = ({ value }) => <AntRate value={value} disabled className="text-sm" />;
const SelectView: React.FC<{ value?: any; dataSource?: any[] }> = ({ value, dataSource = [] }) => {
  const item = dataSource.find((d) => d.value === value);
  return <Text>{item?.label ?? value ?? "-"}</Text>;
};
const ArrayView: React.FC<{ rows: React.ReactNode[][] }> = ({ rows }) => (
  <div className="flex flex-col gap-2">
    {rows.length === 0 && <Text type="secondary">暂无</Text>}
    {rows.map((row, i) => (
      <div key={i} className="rounded-md bg-gray-50 p-3">{row}</div>
    ))}
  </div>
);

const ViewItem: React.FC<{ label?: string; children?: React.ReactNode }> = ({ label, children }) => (
  <div className="mb-3">
    <div className="text-xs text-gray-500 mb-1">{label}</div>
    <div>{children}</div>
  </div>
);

const viewComponents: ComponentMap = {
  Input: TextView, Textarea: TextView, Select: SelectView,
  Switch: SwitchView, DateInput: TextView, Rate: RateView, ArrayCards: ArrayView,
};
const viewDecorators: DecoratorMap = { FormItem: ViewItem };

export const ViewDemo: React.FC = () => {
  const form = useCreateForm({ initialValues: mockData, handlers });
  return (
    <FormProvider form={form} components={viewComponents} decorators={viewDecorators}>
      <SchemaField schema={employeeSchema} />
    </FormProvider>
  );
};
