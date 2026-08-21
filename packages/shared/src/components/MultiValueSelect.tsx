import { Select as AntSelect } from "antd";
import type { FieldComponentProps } from "../types";
import { useFieldMode } from "./field-mode";
import { DisplayValue } from "./DisplayValue";
import { parseMultiValue, serializeMultiValue } from "../compiler";
import { useFieldOptions } from "./service";

/**
 * 多值下拉的通用实现：MultiSelect / TagsInput 共用。
 * 叶子字段只接受基元，多值序列化为 JSON 字符串承载（x-format 在投影时还原为数组）。
 * dataSource（handler/静态）与 service（props 自取）双方案。
 */
export function MultiValueSelect(props: FieldComponentProps & { tags?: boolean }) {
  const mode = useFieldMode(props.mode);
  const items = parseMultiValue(props.value);
  const { options, loading, onSearch } = useFieldOptions(props.service, props.dataSource);
  if (mode === "detail") {
    return <DisplayValue value={items} dataSource={options} />;
  }
  return (
    <AntSelect
      style={{ width: "100%" }}
      mode={props.tags ? "tags" : "multiple"}
      value={items}
      onChange={(next) => props.onChange?.(serializeMultiValue(next))}
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
