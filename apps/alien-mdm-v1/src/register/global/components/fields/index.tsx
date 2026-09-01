import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Flex,
  Form,
  Input as AntInput,
  InputNumber as AntInputNumber,
  Select as AntSelect,
  Switch as AntSwitch,
} from "antd";
import { useEffect, type ReactNode } from "react";
import type { ArrayFieldNode, PrimitiveFieldNode } from "@alien-form/core";
import type { ComponentProps } from "@binding";

export function Input({ value, onChange, ...props }: ComponentProps) {
  return (
    <AntInput
      {...props}
      value={value as string | undefined}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}

export function TextArea({ value, onChange, ...props }: ComponentProps) {
  return (
    <AntInput.TextArea
      {...props}
      value={value as string | undefined}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}

export function NumberInput({ value, onChange, ...props }: ComponentProps) {
  return (
    <AntInputNumber
      {...props}
      style={{ width: "100%", ...(props.style as object) }}
      value={value as number | null | undefined}
      onChange={(next) => onChange?.(next)}
    />
  );
}

export function Switch({ value, onChange, ...props }: ComponentProps) {
  return <AntSwitch {...props} checked={Boolean(value)} onChange={(next) => onChange?.(next)} />;
}

export function Select({
  value,
  onChange,
  dataSource = [],
  loading,
  onOptionsChange = "clear",
  ...props
}: ComponentProps & { onOptionsChange?: "preserve" | "clear" | "first" }) {
  useEffect(() => {
    if (loading || value == null || onOptionsChange === "preserve") return;
    const options = dataSource as Array<{ value: unknown }>;
    if (options.some((option) => Object.is(option.value, value))) return;
    onChange?.(onOptionsChange === "first" ? options[0]?.value : undefined);
  }, [dataSource, loading, onChange, onOptionsChange, value]);

  return (
    <AntSelect
      {...props}
      allowClear
      value={value}
      options={dataSource as any[]}
      loading={loading}
      onChange={(next) => onChange?.(next)}
    />
  );
}

export function ObjectField({ children }: { children?: ReactNode }) {
  return (
    <Flex vertical gap={12}>
      {children}
    </Flex>
  );
}

export function ArrayCards({ field }: ComponentProps) {
  const array = field as ArrayFieldNode;
  const rows = array.rows();
  return (
    <Flex vertical gap={12}>
      {rows.map((row, index) => (
        <Card
          key={row.id}
          size="small"
          title={`#${index + 1}`}
          extra={
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label="删除"
              onClick={() => array.remove(index)}
            />
          }
        >
          {Array.from(row.children, ([key, child]) => {
            if (child.kind !== "primitive") return null;
            const primitive = child as PrimitiveFieldNode;
            return (
              <Form.Item key={child.id} label={child.title() ?? key}>
                <AntInput
                  value={primitive.value()}
                  onChange={(event) => primitive.setValue(event.target.value)}
                />
              </Form.Item>
            );
          })}
        </Card>
      ))}
      <Button icon={<PlusOutlined />} onClick={() => array.push({})}>
        添加一项
      </Button>
    </Flex>
  );
}
