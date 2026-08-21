import { Checkbox } from "antd";
import type { FieldComponentProps } from "../../types";
import { useFieldMode } from "../field-mode";
import { DisplayValue } from "../DisplayValue";
import { parseMultiValue, serializeMultiValue } from "../../utils/multi-value";

/** 复选框组（多值，内部承载 JSON 字符串）。 */
export default function CheckboxGroup(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  const items = parseMultiValue(props.value);
  if (mode === "detail") {
    return <DisplayValue value={items} dataSource={props.dataSource} />;
  }
  return (
    <Checkbox.Group
      value={items as (string | number)[]}
      onChange={(next) => props.onChange?.(serializeMultiValue(next))}
      disabled={props.disabled}
      options={(props.dataSource ?? []).map((item) => ({ label: item.label, value: item.value }))}
    />
  );
}
