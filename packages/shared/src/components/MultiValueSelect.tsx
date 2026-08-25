import { Select as AntSelect } from "antd";
import type { FieldComponentProps } from "../types";
import { useFieldMode } from "./field-mode";
import { DisplayValue } from "./DisplayValue";
import { parseMultiValue, refValue, serializeMultiValue, withRefEchoOptions } from "../compiler";
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
  // 各项可能是服务端展开的引用对象 { $ref, value, label }：显示/匹配用 value，
  // 并为每个引用补 echo 选项，保证远程分页未拉到时仍能回显出 name。
  const echoOptions = withRefEchoOptions(options, items);
  return (
    <AntSelect
      style={{ width: "100%" }}
      mode={props.tags ? "tags" : "multiple"}
      value={items.map((item) => refValue(item)) as (string | number)[]}
      onChange={(next) => props.onChange?.(serializeMultiValue(next))}
      disabled={props.disabled}
      loading={props.loading || loading}
      placeholder={props.placeholder}
      showSearch={onSearch ? { onSearch, filterOption: false } : true}
      options={echoOptions.map((item) => ({ label: item.label, value: item.value }))}
      allowClear
    />
  );
}
