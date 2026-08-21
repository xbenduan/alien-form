import type { FieldComponentProps } from "../../types";
import { MultiValueSelect } from "../MultiValueSelect";

/** 标签输入（多值，内部承载 JSON 字符串）。 */
export default function TagsInput(props: FieldComponentProps) {
  return <MultiValueSelect {...props} tags />;
}
