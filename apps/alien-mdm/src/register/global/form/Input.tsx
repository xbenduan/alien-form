import { Input as AntInput } from "antd";
import type { FieldComponentProps } from "../../../types/shared";
import { useFieldMode } from "../../../components/field-mode";
import { DisplayValue } from "../../../components/DisplayValue";

/** 单行文本输入。 */
export default function Input(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  if (mode === "detail") return <DisplayValue value={props.value} ellipsis />;
  return (
    <AntInput
      value={(props.value as string) ?? ""}
      onChange={(event) => props.onChange?.(event.target.value)}
      disabled={props.disabled}
      placeholder={props.placeholder}
    />
  );
}
