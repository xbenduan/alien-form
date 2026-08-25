import type { FieldComponentProps } from "../../../types/shared";
import { MultiValueSelect } from "../../../components/MultiValueSelect";

/** 标签输入（多值，内部承载 JSON 字符串）。 */
export default function TagsInput(props: FieldComponentProps) {
  return <MultiValueSelect {...props} tags />;
}
