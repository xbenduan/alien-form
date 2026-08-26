import { DatePicker } from "antd";
import dayjs from "dayjs";
import { useFormScope } from "@alien-form/react";
import type { FieldComponentProps, FormScope } from "../../../types/shared";
import { DisplayValue } from "../../../components/DisplayValue";

/** 日期选择。 */
export default function DateInput(props: FieldComponentProps) {
  const { mode = "edit" } = useFormScope<FormScope>();
  if (mode === "detail") return <DisplayValue value={props.value} format="date" />;
  return (
    <DatePicker
      style={{ width: "100%" }}
      value={props.value ? dayjs(props.value as string) : null}
      onChange={(_, dateString) => props.onChange?.(String(dateString))}
      disabled={props.disabled}
      placeholder={props.placeholder}
    />
  );
}
