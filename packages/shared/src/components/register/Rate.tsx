import { Rate as AntRate } from "antd";
import type { FieldComponentProps } from "../../types";
import { useFieldMode } from "../field-mode";

/** 评分。 */
export default function Rate(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  if (mode === "detail") {
    const value = typeof props.value === "number" ? props.value : Number(props.value);
    return <AntRate disabled value={Number.isNaN(value) ? 0 : value} />;
  }
  return (
    <AntRate
      value={props.value as number}
      onChange={(next) => props.onChange?.(next)}
      disabled={props.disabled}
    />
  );
}
