import { InputNumber } from "../ui";
import type { BaseFieldProps } from "./types";

export function NumberInput({
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
  min,
  max,
}: BaseFieldProps & {
  value?: number;
  onChange?: (nextValue: number | null) => void;
  min?: number;
  max?: number;
}) {
  return (
    <InputNumber
      style={{ width: "100%" }}
      value={value}
      onChange={(nextValue) => onChange?.(nextValue)}
      disabled={disabled || readOnly}
      placeholder={placeholder}
      min={min}
      max={max}
    />
  );
}

export default NumberInput;
