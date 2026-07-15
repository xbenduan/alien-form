import { Input as AntInput } from "../ui";
import type { BaseFieldProps } from "./types";

const { TextArea } = AntInput;

export function Textarea({
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

export default Textarea;
