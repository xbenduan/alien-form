import {
  Input,
  Text,
  NumberInput,
  BooleanField,
  NullValue,
} from "../../components/fields/primitives";
import { ObjectFields, ArrayFields } from "../../components/fields/structured";
import { Select } from "../../components/fields/select";
import type { ComponentRegistry } from "formwork";
import { FormItem } from "../../components/fields/field-container";
import { Shell } from "../shell/root";
import { PagePresenter } from "../presenters/page";
import { ModalPresenter } from "../presenters/modal";
import { DrawerPresenter } from "../presenters/drawer";
import {
  ListLayout,
  ListActions,
  ListFilters,
  ListTable,
  ListPagination,
  DetailLayout,
  EditorLayout,
  Loading,
  Empty,
  Failure,
  Confirmation,
} from "./records";

/** 统一注册应用的字段、列表和操作承载组件。 */
export const components: ComponentRegistry = {
  FormItem,
  Shell,
  PagePresenter,
  ModalPresenter,
  DrawerPresenter,
  ListLayout,
  ListActions,
  ListFilters,
  ListTable,
  ListPagination,
  DetailLayout,
  EditorLayout,
  Loading,
  Empty,
  Failure,
  Confirmation,
  Input,
  Text,
  NumberInput,
  Select,
  Boolean: BooleanField,
  ObjectFields,
  ArrayFields,
  Null: NullValue,
  Button: (props) => (
    <button class="button secondary" onClick={props.onClick} disabled={props.disabled}>
      {props.title ?? props.children}
    </button>
  ),
};
