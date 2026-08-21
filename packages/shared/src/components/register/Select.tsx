import { Select as AntSelect } from "antd";
import type { FieldComponentProps } from "../../types";
import { useFieldMode } from "../field-mode";
import { DisplayValue } from "../DisplayValue";
import { useFieldOptions } from "../service";

/** 下拉单选。dataSource（handler/静态）与 service（props 自取）双方案。 */
export default function Select(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  const { options, loading, onSearch } = useFieldOptions(props.service, props.dataSource);
  if (mode === "detail") {
    return <DisplayValue value={props.value} dataSource={options} format="status" />;
  }
  return (
    <AntSelect
      style={{ width: "100%" }}
      value={props.value}
      onChange={(next) => props.onChange?.(next)}
      disabled={props.disabled}
      loading={props.loading || loading}
      placeholder={props.placeholder}
      showSearch={Boolean(onSearch) || undefined}
      filterOption={onSearch ? false : undefined}
      onSearch={onSearch}
      options={options.map((item) => ({ label: item.label, value: item.value }))}
      allowClear
    />
  );
}
