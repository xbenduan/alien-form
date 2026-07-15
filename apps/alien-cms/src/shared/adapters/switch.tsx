import { Switch as AntSwitch } from "../ui";
import type { BaseFieldProps } from "./types";

export function Switch({
  value,
  onChange,
  disabled,
  readOnly,
}: BaseFieldProps & {
  value?: boolean;
  onChange?: (nextValue: boolean) => void;
}) {
  return (
    <AntSwitch
      checked={Boolean(value)}
      onChange={(nextValue) => onChange?.(nextValue)}
      disabled={disabled || readOnly}
    />
  );
}

export default Switch;
