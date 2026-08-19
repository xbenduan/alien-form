import type { ComponentType } from "react";
import type { FieldComponentProps } from "../types";
import {
  CheckboxGroup,
  DateInput,
  Input,
  MultiSelect,
  NumberInput,
  Radio,
  Rate,
  Select,
  Switch,
  TagsInput,
  Textarea,
} from "./leaf";
import { ArrayCards, ObjectField } from "./complex";
import { GridLayout } from "./layout";
import { FilterItem, FormItem } from "./decorators";

/** component 名 → React 组件，交给 @alien-form/react 的 FormProvider 消费。 */
export const fieldComponents: Record<string, ComponentType<FieldComponentProps>> = {
  Input,
  Textarea,
  NumberInput,
  Select,
  MultiSelect,
  DateInput,
  Switch,
  Radio,
  CheckboxGroup,
  Rate,
  TagsInput,
  ObjectField,
  ArrayCards,
  GridLayout,
};

export const fieldDecorators = {
  FormItem,
  FilterItem,
} as const;
