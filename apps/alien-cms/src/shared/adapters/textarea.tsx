import { defineAdapter } from "@alien-form/cms";
import { Input as AntInput } from "antd";
import type { BaseFieldProps } from "./types";

const { TextArea } = AntInput;

function Textarea({
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
  rows = 4,
}: BaseFieldProps & {
  value?: string;
  onChange?: (nextValue: string) => void;
  rows?: number;
}) {
  return (
    <TextArea
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      disabled={disabled || readOnly}
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
  scenes: { form: {}, filter: { renderAs: "Input", operator: "contains" }, detail: "DisplayText", table: { renderAs: "DisplayText", summary: true } },
  meta: { fieldType: "string" },
});
