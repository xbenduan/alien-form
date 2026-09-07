import { Select as AntSelect } from "antd";
import { useEffect, type ReactNode } from "react";
import type { DataSourceItem } from "@alien-form/core";
import type { ComponentProps } from "@alien-form/react";
import { DetailValue, buildProps } from "./shared";

const EMPTY_OPTIONS: DataSourceItem[] = [];

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
