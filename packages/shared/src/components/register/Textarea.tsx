import { Input as AntInput } from "antd";
import type { FieldComponentProps } from "../../types";
import { useFieldMode } from "../field-mode";
import { DisplayValue } from "../DisplayValue";

const { TextArea } = AntInput;

/** 多行文本输入。 */
export default function Textarea(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  if (mode === "detail") return <DisplayValue value={props.value} />;
  const rows = typeof props.rows === "number" ? props.rows : 4;
  return (
    <TextArea
      value={(props.value as string) ?? ""}
      onChange={(event) => props.onChange?.(event.target.value)}
      disabled={props.disabled}
      placeholder={props.placeholder}
      rows={rows}
    />
  );
}
