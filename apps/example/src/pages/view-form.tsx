import React from "react";
import { Typography, Tag, Rate as AntRate, Descriptions } from "antd";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type ComponentMap,
  type DecoratorMap,
} from "@alien-form/react";
import { employeeSchema, mockEmployeeData } from "@/schema";
import { handlers } from "@/handlers";

const { Text } = Typography;

// ─── Read-only components ─────────────────────────────────────────────────

const TextView: React.FC<{ value?: any }> = ({ value }) => (
  <Text>{value ?? "-"}</Text>
);

const SwitchView: React.FC<{ value?: boolean }> = ({ value }) => (
  <Tag color={value ? "green" : "default"}>{value ? "是" : "否"}</Tag>
);

const RateView: React.FC<{ value?: number }> = ({ value }) => (
  <AntRate value={value} disabled style={{ fontSize: 14 }} />
);

const SelectView: React.FC<{ value?: any; dataSource?: any[] }> = ({ value, dataSource = [] }) => {
  const item = dataSource.find((d) => d.value === value);
  return <Text>{item?.label ?? value ?? "-"}</Text>;
};

// ─── Read-only decorator ──────────────────────────────────────────────────

const ViewFormItem: React.FC<{
  label?: string;
  children?: React.ReactNode;
  description?: string;
}> = ({ label, children }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ color: "#666", fontSize: 13, marginBottom: 4 }}>{label}</div>
    <div>{children}</div>
  </div>
);

// ─── Component maps ───────────────────────────────────────────────────────

const viewComponents: ComponentMap = {
  Input: TextView,
  Textarea: TextView,
  Select: SelectView,
  Switch: SwitchView,
  DateInput: TextView,
  Rate: RateView,
  ArrayCards: ({ rows }: { rows: React.ReactNode[][] }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.length === 0 && <Text type="secondary">暂无数据</Text>}
      {rows.map((row, i) => (
        <div key={i} style={{ padding: "8px 12px", background: "#fafafa", borderRadius: 6 }}>
          {row}
        </div>
      ))}
    </div>
  ),
};

const viewDecorators: DecoratorMap = { FormItem: ViewFormItem };

// ─── ViewForm ─────────────────────────────────────────────────────────────

export const ViewForm: React.FC = () => {
  const form = useCreateForm({ initialValues: mockEmployeeData, handlers });

  return (
    <FormProvider form={form} components={viewComponents} decorators={viewDecorators}>
      <SchemaField schema={employeeSchema} />
    </FormProvider>
  );
};
