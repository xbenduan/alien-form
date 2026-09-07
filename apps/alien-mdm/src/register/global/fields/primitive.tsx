import { Input as AntInput, InputNumber as AntInputNumber, Select as AntSelect } from "antd";
import { useEffect, type ReactNode } from "react";
import type { DataSourceItem } from "@alien-form/core";
import type { ComponentProps } from "@binding";
import { DetailValue, nativeProps } from "./shared";

const EMPTY_OPTIONS: DataSourceItem[] = [];

export function Input(props: ComponentProps) {
  if (props.mode === "detail" || props.readOnly) return <DetailValue value={props.value} />;

  return (
    <AntInput
      {...nativeProps(props)}
      placeholder={props.placeholder || "请输入"}
      value={props.value as string | undefined}
      onChange={(event) => props.onChange?.(event.target.value)}
    />
  );
}

export function TextArea(props: ComponentProps) {
  if (props.mode === "detail" || props.readOnly) return <DetailValue value={props.value} />;
  const controlProps = nativeProps(props);
  if (props.isFilter) controlProps.rows = 1;
  return (
    <AntInput.TextArea
      {...controlProps}
      placeholder={props.placeholder || "请输入"}
      style={{ width: "100%", ...(controlProps.style as object) }}
      value={props.value as string | undefined}
      onChange={(event) => props.onChange?.(event.target.value)}
    />
  );
}

export function NumberInput(props: ComponentProps) {
  if (props.mode === "detail" || props.readOnly) return <DetailValue value={props.value} />;
  const controlProps = nativeProps(props);
  return (
    <AntInputNumber
      {...controlProps}
      placeholder={props.placeholder || "请输入"}
      style={{ width: "100%", ...(controlProps.style as object) }}
      value={props.value as number | null | undefined}
      onChange={(next) => props.onChange?.(next)}
    />
  );
}

export function Select(
  props: ComponentProps & { isFilter?: boolean; onOptionsChange?: "preserve" | "clear" | "first" },
) {
  const { value, onChange, loading, isFilter, onOptionsChange = "clear" } = props;
  const options = (
    Array.isArray(props.dataSource) ? props.dataSource : EMPTY_OPTIONS
  ) as DataSourceItem[];
  useEffect(() => {
    // filter 场景下选项与查询条件相互独立,不做“选项刷新即清值”的联动处理。
    if (
      props.mode === "detail" ||
      props.readOnly ||
      isFilter ||
      loading ||
      value == null ||
      onOptionsChange === "preserve"
    ) {
      return;
    }
    if (options.some((option) => Object.is(option.value, value))) return;
    onChange?.(onOptionsChange === "first" ? options[0]?.value : undefined);
  }, [isFilter, loading, onChange, onOptionsChange, options, props.mode, props.readOnly, value]);

  if (props.mode === "detail" || props.readOnly) {
    const option = (options as Array<{ label?: ReactNode; value: unknown }>).find((item) =>
      Object.is(item.value, value),
    );
    return <DetailValue value={option?.label ?? value} />;
  }

  const controlProps = nativeProps(props);
  return (
    <AntSelect
      {...controlProps}
      placeholder={props.placeholder || "请选择"}
      allowClear
      style={{ width: "100%", ...(controlProps.style as object) }}
      value={value}
      options={options as any[]}
      loading={loading}
      onChange={(next) => onChange?.(next)}
    />
  );
}
