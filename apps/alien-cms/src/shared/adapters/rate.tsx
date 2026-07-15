import { Rate as AntRate } from "../ui";
import type { BaseFieldProps } from "./types";

export function Rate({
  value,
  onChange,
  disabled,
  readOnly,
}: BaseFieldProps & {
  value?: number;
  onChange?: (v: number) => void;
}) {
  return <AntRate value={value} onChange={(v) => onChange?.(v)} disabled={disabled || readOnly} />;
}

export default Rate;
