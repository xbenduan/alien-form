import { Radio as AntRadio } from "antd";
import type { FieldComponentProps } from "../../types";
import { useFieldMode } from "../field-mode";
import { DisplayValue } from "../DisplayValue";

/** 单选按钮组。 */
export default function Radio(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  if (mode === "detail") {
    return <DisplayValue value={props.value} dataSource={props.dataSource} />;
  }
  return (
    <AntRadio.Group
      value={props.value}
      onChange={(event) => props.onChange?.(event.target.value)}
      disabled={props.disabled}
    >
      {(props.dataSource ?? []).map((item) => (
        <AntRadio key={String(item.value)} value={item.value}>
          {item.label}
        </AntRadio>
      ))}
    </AntRadio.Group>
  );
}
