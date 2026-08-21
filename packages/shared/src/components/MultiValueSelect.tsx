import { Select as AntSelect } from "antd";
import type { FieldComponentProps } from "../types";
import { useFieldMode } from "./field-mode";
import { DisplayValue } from "./DisplayValue";
import { parseMultiValue, serializeMultiValue } from "../utils/multi-value";

/**
 * 多值下拉的通用实现：MultiSelect / TagsInput 共用（register/ 中两者的依赖组件）。
 * 叶子字段只接受基元，多值序列化为 JSON 字符串承载（x-format 在投影时还原为数组）。
 */
export function MultiValueSelect(props: FieldComponentProps & { tags?: boolean }) {
  const mode = useFieldMode(props.mode);
  const items = parseMultiValue(props.value);
  if (mode === "detail") {
    return <DisplayValue value={items} dataSource={props.dataSource} />;
  }
  return (
    <AntSelect
      style={{ width: "100%" }}
      mode={props.tags ? "tags" : "multiple"}
      value={items}
      onChange={(next) => props.onChange?.(serializeMultiValue(next))}
      disabled={props.disabled}
      loading={props.loading}
      placeholder={props.placeholder}
      options={(props.dataSource ?? []).map((item) => ({ label: item.label, value: item.value }))}
      allowClear
    />
  );
}
