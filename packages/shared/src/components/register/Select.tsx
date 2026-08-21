import { Select as AntSelect } from "antd";
import type { FieldComponentProps } from "../../types";
import { useFieldMode } from "../field-mode";
import { DisplayValue } from "../DisplayValue";

/** 下拉单选。 */
export default function Select(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  if (mode === "detail") {
    return <DisplayValue value={props.value} dataSource={props.dataSource} format="status" />;
  }
  return (
    <AntSelect
      style={{ width: "100%" }}
      value={props.value}
      onChange={(next) => props.onChange?.(next)}
      disabled={props.disabled}
      loading={props.loading}
      placeholder={props.placeholder}
      options={(props.dataSource ?? []).map((item) => ({ label: item.label, value: item.value }))}
      allowClear
    />
  );
}
