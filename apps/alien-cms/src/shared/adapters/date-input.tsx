import { defineAdapter } from "@alien-form/cms";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import type { BaseFieldProps } from "./types";

function DateInput({
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
}: BaseFieldProps & {
  value?: string;
  onChange?: (nextValue: string) => void;
}) {
  return (
    <DatePicker
      style={{ width: "100%" }}
      value={value ? dayjs(value) : null}
      onChange={(_, dateString) => onChange?.(String(dateString))}
      disabled={disabled || readOnly}
      placeholder={placeholder}
    />
  );
}

export default defineAdapter(DateInput, {
  key: "DateInput",
  label: "选择日期",
  description: "日期输入组件。",
  kind: "component",
  scenes: { form: {}, filter: {}, detail: "DisplayDate", table: { renderAs: "DisplayDate", summary: true } },
  meta: { fieldType: "string" },
});
