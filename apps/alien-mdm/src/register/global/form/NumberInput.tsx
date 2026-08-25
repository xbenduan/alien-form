import { InputNumber } from "antd";
import type { FieldComponentProps } from "../../../types/shared";
import { useFieldMode } from "../../../components/field-mode";
import { DisplayValue } from "../../../components/DisplayValue";

/** 数字输入。 */
export default function NumberInput(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  if (mode === "detail") return <DisplayValue value={props.value} />;
  return (
    <InputNumber
      style={{ width: "100%" }}
      value={props.value as number}
      onChange={(next) => props.onChange?.(next)}
      disabled={props.disabled}
      placeholder={props.placeholder}
      min={props.min as number | undefined}
      max={props.max as number | undefined}
    />
  );
}
