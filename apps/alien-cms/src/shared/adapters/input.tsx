import { defineAdapter } from "@alien-form/cms";
import { Input as AntInput } from "antd";

function Input({
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
  type?: string;
  format?: string;
}) {
  return (
    <AntInput
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}

export default defineAdapter(Input, {
  key: "Input",
  label: "文本输入",
  description: "基础文本输入组件。",
  kind: "component",
  scenes: ["recordForm", "recordFilter"],
  meta: { fieldType: "string" },
});
