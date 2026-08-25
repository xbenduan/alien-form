import { Select as AntSelect } from "antd";
import type { FieldComponentProps } from "../../../types/shared";
import { useFieldMode } from "../../../components/field-mode";
import { DisplayValue } from "../../../components/DisplayValue";
import { refValue, withRefEchoOptions } from "../../../compiler";
import { useFieldOptions } from "../../../components/service";

/** 下拉单选。dataSource（handler/静态）与 service（props 自取）双方案。 */
export default function Select(props: FieldComponentProps) {
  const mode = useFieldMode(props.mode);
  const { options, loading, onSearch } = useFieldOptions(props.service, props.dataSource);
  if (mode === "detail") {
    return <DisplayValue value={props.value} dataSource={options} format="status" />;
  }
  // 值可能是服务端展开的引用对象 { $ref, value, label }：显示/匹配用 value，
  // 并补一个 echo 选项，保证远程分页未拉到该项时仍能回显出 name。
  const echoOptions = withRefEchoOptions(options, props.value);
  return (
    <AntSelect
      style={{ width: "100%" }}
      value={refValue(props.value) as string | number | undefined}
      onChange={(next) => props.onChange?.(next)}
      disabled={props.disabled}
      loading={props.loading || loading}
      placeholder={props.placeholder}
      showSearch={onSearch ? { onSearch, filterOption: false } : true}
      options={echoOptions.map((item) => ({ label: item.label, value: item.value }))}
      allowClear
    />
  );
}
