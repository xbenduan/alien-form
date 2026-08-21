import type { FieldComponentProps } from "../../types";
import { MultiValueSelect } from "../MultiValueSelect";

/** 下拉多选（多值，内部承载 JSON 字符串）。 */
export default function MultiSelect(props: FieldComponentProps) {
  return <MultiValueSelect {...props} />;
}
