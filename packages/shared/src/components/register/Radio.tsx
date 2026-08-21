import { Radio as AntRadio } from "antd";
import type { FieldComponentProps } from "../../types";
import { useFieldMode } from "../field-mode";
import { DisplayValue } from "../DisplayValue";
import { useFieldOptions } from "../service";

/** 单选按钮组。dataSource（handler/静态）与 service（props 自取）双方案。 */
export default function Radio(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  const { options } = useFieldOptions(props.service, props.dataSource);
  if (mode === "detail") {
    return <DisplayValue value={props.value} dataSource={options} />;
  }
  return (
    <AntRadio.Group
      value={props.value}
      onChange={(event) => props.onChange?.(event.target.value)}
      disabled={props.disabled}
    >
      {options.map((item) => (
        <AntRadio key={String(item.value)} value={item.value}>
          {item.label}
        </AntRadio>
      ))}
    </AntRadio.Group>
  );
}
