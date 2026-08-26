import { Select as AntSelect } from "antd";
import { useFormScope } from "@alien-form/react";
import type { FieldComponentProps, FormScope } from "../types/shared";
import { DisplayValue } from "./DisplayValue";
import {
  parseMultiValue,
  refValue,
  serializeMultiValue,
  withRefEchoOptions,
} from "../utils/field-values";
import { useFieldOptions } from "@hooks/service";

/** 按需加载远程选项的 Select。 */
export function RemoteSelect(props: FieldComponentProps) {
  const { mode = "edit" } = useFormScope<FormScope>();
  const isMulti = props.selectMode === "multiple" || props.selectMode === "tags";
  const items = isMulti ? parseMultiValue(props.value) : [];
  const { options, loading, onSearch, load } = useFieldOptions(
    props.service,
    props.dataSource,
    isMulti ? items : props.value,
  );

  if (mode === "detail") {
    return <DisplayValue value={isMulti ? items : props.value} dataSource={options} />;
  }

  const value = isMulti
    ? (items.map((item) => refValue(item)) as Array<string | number>)
    : (refValue(props.value) as string | number | undefined);
  const echoOptions = withRefEchoOptions(options, isMulti ? items : props.value);
  return (
    <AntSelect
      style={{ width: "100%" }}
      mode={props.selectMode}
      value={value}
      onChange={(next) => props.onChange?.(isMulti ? serializeMultiValue(next) : next)}
      disabled={props.disabled}
      loading={props.loading || loading}
      placeholder={props.placeholder}
      showSearch={onSearch ? { onSearch, filterOption: false } : true}
      onOpenChange={(open) => {
        if (open) load();
      }}
      options={echoOptions.map((item) => ({ label: item.label, value: item.value }))}
      allowClear
    />
  );
}
