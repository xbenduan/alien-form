import { DatePicker } from "antd";
import dayjs from "dayjs";
import type { FieldComponentProps } from "../../../types/shared";
import { useFieldMode } from "../../../components/field-mode";
import { DisplayValue } from "../../../components/DisplayValue";

/** 日期选择。 */
export default function DateInput(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
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
