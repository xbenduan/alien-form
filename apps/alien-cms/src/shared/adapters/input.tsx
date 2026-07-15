import { Input as AntInput } from "../ui";
import type { BaseFieldProps } from "./types";

export function Input({
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

export default Input;
