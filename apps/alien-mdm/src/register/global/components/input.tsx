import { Input as AntInput, InputNumber as AntInputNumber } from "antd";
import type { ComponentProps } from "@alien-form/react";
import { DetailValue, buildProps } from "./shared";

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
