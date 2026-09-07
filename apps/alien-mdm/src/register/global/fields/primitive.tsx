import {
  DatePicker as AntDatePicker,
  Input as AntInput,
  InputNumber as AntInputNumber,
  Select as AntSelect,
} from "antd";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { useEffect, type ReactNode } from "react";
import type { DataSourceItem } from "@alien-form/core";
import type { ComponentProps } from "@binding";
import { DetailValue, buildProps } from "./shared";

const EMPTY_OPTIONS: DataSourceItem[] = [];
dayjs.locale("zh-cn");

export function Input(props: ComponentProps) {
  const { mode, controlProps, value, onChange } = buildProps(props);
  if (mode === "detail") return <DetailValue value={value} />;

  return (
    <AntInput
      {...controlProps}
      placeholder={(controlProps.placeholder as string | undefined) || "请输入"}
      value={value as string | undefined}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}

export function TextArea(props: ComponentProps) {
  const { mode, controlProps, value, onChange, isFilter } = buildProps(props);
  if (mode === "detail") return <DetailValue value={value} />;
  if (isFilter) controlProps.rows = 1;
  return (
    <AntInput.TextArea
      {...controlProps}
      placeholder={(controlProps.placeholder as string | undefined) || "请输入"}
      style={{ width: "100%", ...(controlProps.style as object) }}
      value={value as string | undefined}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}

export function NumberInput(props: ComponentProps) {
  const { mode, controlProps, value, onChange } = buildProps(props);
  if (mode === "detail") return <DetailValue value={value} />;
  return (
    <AntInputNumber
      {...controlProps}
      placeholder={(controlProps.placeholder as string | undefined) || "请输入"}
      style={{ width: "100%", ...(controlProps.style as object) }}
      value={value as number | null | undefined}
      onChange={(next) => onChange?.(next)}
    />
  );
}

export function Select(
  props: ComponentProps & { isFilter?: boolean; onOptionsChange?: "preserve" | "clear" | "first" },
) {
  const { mode, controlProps, value, onChange, loading, isFilter, dataSource } = buildProps(props);
  const onOptionsChange = (controlProps.onOptionsChange ?? "clear") as
    | "preserve"
    | "clear"
    | "first";
  const options = (Array.isArray(dataSource) ? dataSource : EMPTY_OPTIONS) as DataSourceItem[];
  useEffect(() => {
    // filter 场景下选项与查询条件相互独立,不做“选项刷新即清值”的联动处理。
    if (
      mode === "detail" ||
      isFilter ||
      loading ||
      value == null ||
      onOptionsChange === "preserve"
    ) {
      return;
    }
    if (options.some((option) => Object.is(option.value, value))) return;
    onChange?.(onOptionsChange === "first" ? options[0]?.value : undefined);
  }, [isFilter, loading, mode, onChange, onOptionsChange, options, value]);
  if (mode === "detail") {
    const option = (options as Array<{ label?: ReactNode; value: unknown }>).find((item) =>
      Object.is(item.value, value),
    );
    return <DetailValue value={option?.label ?? value} />;
  }

  return (
    <AntSelect
      {...controlProps}
      placeholder={(controlProps.placeholder as string | undefined) || "请选择"}
      allowClear
      style={{ width: "100%", ...(controlProps.style as object) }}
      value={value}
      options={options as any[]}
      loading={loading}
      onChange={(next) => onChange?.(next)}
    />
  );
}

export function DatePicker(props: ComponentProps) {
  const { mode, controlProps, value, onChange } = buildProps(props);
  const showTime = controlProps.showTime === true;
  const format = showTime ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD";
  if (mode === "detail") {
    const date =
      value === undefined || value === null || value === ""
        ? null
        : dayjs(value as string | number);
    return <DetailValue value={date?.isValid() ? date.format(format) : value} />;
  }

  const dateValue =
    value === undefined || value === null || value === "" ? null : dayjs(value as string | number);
  return (
    <AntDatePicker
      {...controlProps}
      value={dateValue?.isValid() ? dateValue : null}
      showTime={showTime}
      format={format}
      style={{ width: "100%", ...(controlProps.style as object) }}
      onChange={(next) => onChange?.(next ? next.format(format) : undefined)}
    />
  );
}
