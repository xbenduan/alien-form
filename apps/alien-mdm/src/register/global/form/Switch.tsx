import { Switch as AntSwitch } from "antd";
import type { FieldComponentProps } from "../../../types/shared";
import { useFieldMode } from "../../../components/field-mode";
import { DisplayValue } from "../../../components/DisplayValue";

/** 开关（布尔）。 */
export default function Switch(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  if (mode === "detail") return <DisplayValue value={props.value} format="boolean" />;
  return (
    <AntSwitch
      checked={Boolean(props.value)}
      onChange={(next) => props.onChange?.(next)}
      disabled={props.disabled}
    />
  );
}
