import {
  ArrayFields,
  Input,
  NullValue,
  NumberInput,
  ObjectFields,
  Select,
  Switch,
} from "./ui/fields";
import type { ComponentRegistry } from "formwork";

/** 注册默认字段 Adapter，私域可以按名称稀疏替换。 */
export const components: ComponentRegistry = {
  Input,
  NumberInput,
  Select,
  Switch,
  Object: ObjectFields,
  Array: ArrayFields,
  Null: NullValue,
  Button: (props) => (
    <button class="button secondary" onClick={props.onClick} disabled={props.disabled}>
      {props.title ?? props.children}
    </button>
  ),
};
