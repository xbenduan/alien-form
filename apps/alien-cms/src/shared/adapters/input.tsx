import { defineAdapter } from "@alien-form/cms";
import { Input as AntInput } from "../ui";
import type { BaseFieldProps } from "./types";

function Input({
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
}: BaseFieldProps & {
  value?: string;
  onChange?: (nextValue: string) => void;
  type?: string;
}) {
  return (
    <AntInput
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      disabled={disabled || readOnly}
      placeholder={placeholder}
    />
  );
}

export default defineAdapter(Input, {
  key: "Input",
  label: "文本输入",
  description: "基础文本输入组件。",
  kind: "component",
  scenes: { form: {}, filter: { operator: "contains" }, detail: "DisplayText", table: { renderAs: "DisplayText", summary: true } },
  meta: { fieldType: "string" },
});
