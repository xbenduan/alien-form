import { Input as AntInput } from "antd";
import { useFormScope } from "@alien-form/react";
import type { FieldComponentProps, FormScope } from "../../../types/shared";
import { DisplayValue } from "@components/display-value";

/** 单行文本输入。 */
export default function Input(props: FieldComponentProps) {
  const { mode = "edit" } = useFormScope<FormScope>();
  if (mode === "detail") return <DisplayValue value={props.value} ellipsis />;
  return (
    <AntInput
      value={(props.value as string) ?? ""}
      onChange={(event) => props.onChange?.(event.target.value)}
      disabled={props.disabled}
      placeholder={props.placeholder}
    />
  );
}
