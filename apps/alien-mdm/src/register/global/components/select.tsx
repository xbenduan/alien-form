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
  const multiple = controlProps.mode === "multiple";
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
    const values = multiple && Array.isArray(value) ? value : [value];
    if (values.every((item) => options.some((option) => Object.is(option.value, item)))) return;
    onChange?.(onOptionsChange === "first" ? options[0]?.value : multiple ? [] : undefined);
  }, [isFilter, loading, mode, multiple, onChange, onOptionsChange, options, value]);
  if (mode === "detail") {
    const values = Array.isArray(value) ? value : [value];
    const labels = values.map(
      (entry) =>
        (options as Array<{ label?: ReactNode; value: unknown }>).find((item) =>
          Object.is(item.value, entry),
        )?.label ?? entry,
    );
    return <DetailValue value={labels.join(", ")} />;
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
