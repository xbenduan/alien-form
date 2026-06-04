import { defineAdapter } from "@alien-form/cms";
import { Input as AntInput } from "antd";

const { TextArea } = AntInput;

function Textarea({
  value,
  onChange,
  disabled,
  placeholder,
  rows = 4,
}: {
  value?: string;
  onChange?: (nextValue: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  rows?: number;
  format?: string;
}) {
  return (
    <TextArea
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      rows={rows}
    />
  );
}

export default defineAdapter(Textarea, {
  key: "Textarea",
  label: "多行文本",
  description: "多行文本输入组件。",
  kind: "component",
  scenes: ["recordForm", "recordFilter"],
  meta: { fieldType: "string" },
});
