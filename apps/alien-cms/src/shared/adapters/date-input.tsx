import { defineAdapter } from "@alien-form/cms";
import { DatePicker } from "antd";
import dayjs from "dayjs";

function DateInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value?: string;
  onChange?: (nextValue: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  format?: string;
}) {
  return (
    <DatePicker
      style={{ width: "100%" }}
      value={value ? dayjs(value) : null}
      onChange={(_, dateString) => onChange?.(String(dateString))}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}

export default defineAdapter(
  DateInput,
  {
    key: "DateInput",
    label: "DateInput",
    description: "日期输入组件。",
    kind: "component",
    scenes: ["recordForm", "recordFilter"],
    meta: { fieldType: "string" },
  },
);
