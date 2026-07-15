import { DatePicker } from "../ui";
import dayjs from "dayjs";
import type { BaseFieldProps } from "./types";

export function DateInput({
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

export default DateInput;
