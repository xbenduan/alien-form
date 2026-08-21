import { Checkbox } from "antd";
import type { FieldComponentProps } from "../../types";
import { useFieldMode } from "../field-mode";
import { DisplayValue } from "../DisplayValue";
import { parseMultiValue, serializeMultiValue } from "../../compiler";
import { useFieldOptions } from "../service";

/** 复选框组（多值，内部承载 JSON 字符串）。dataSource / service 双方案。 */
export default function CheckboxGroup(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  const items = parseMultiValue(props.value);
  const { options } = useFieldOptions(props.service, props.dataSource);
  if (mode === "detail") {
    return <DisplayValue value={items} dataSource={options} />;
  }
  return (
    <Checkbox.Group
      value={items as (string | number)[]}
      onChange={(next) => props.onChange?.(serializeMultiValue(next))}
      disabled={props.disabled}
      options={options.map((item) => ({ label: item.label, value: item.value }))}
    />
  );
}
