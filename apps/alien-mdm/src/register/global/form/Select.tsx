import { Select as AntSelect } from "antd";
import { useFormScope } from "@alien-form/react";
import type { FieldComponentProps, FormScope } from "../../../types/shared";
import { DisplayValue } from "../../../components/DisplayValue";
import { RemoteSelect } from "../../../components/RemoteSelect";
import { parseMultiValue, refValue, serializeMultiValue } from "../../../compiler";

/** 本地 Select；声明 service 时委托给按需加载的 RemoteSelect。 */
export default function Select(props: FieldComponentProps) {
  const { mode = "edit" } = useFormScope<FormScope>();
  if (props.service) return <RemoteSelect {...props} />;

  const isMulti = props.selectMode === "multiple" || props.selectMode === "tags";
  const items = isMulti ? parseMultiValue(props.value) : [];
  if (mode === "detail") {
    return <DisplayValue value={isMulti ? items : props.value} dataSource={props.dataSource} />;
  }

  const value = isMulti
    ? (items.map((item) => refValue(item)) as Array<string | number>)
    : (refValue(props.value) as string | number | undefined);
  return (
    <AntSelect
      style={{ width: "100%" }}
      mode={props.selectMode}
      value={value}
      onChange={(next) => props.onChange?.(isMulti ? serializeMultiValue(next) : next)}
      disabled={props.disabled}
      loading={props.loading}
      placeholder={props.placeholder}
      showSearch
      options={props.dataSource?.map((item) => ({ label: item.label, value: item.value }))}
      allowClear
    />
  );
}
