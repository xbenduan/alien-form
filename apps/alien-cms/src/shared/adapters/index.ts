import React from "react";
import type { BuilderComponentName, BuilderFieldType } from "@alien-form/cms";

import { ArrayCards } from "./array-cards";
import { CheckboxGroup } from "./checkbox-group";
import { DateInput } from "./date-input";
import { DisplayBoolean } from "./display-boolean";
import { DisplayChoice } from "./display-choice";
import { DisplayDate } from "./display-date";
import { DisplayRate } from "./display-rate";
import { DisplayTags } from "./display-tags";
import { DisplayText } from "./display-text";
import { EditableTable } from "./editable-table";
import { FlexLayout } from "./flex-layout";
import { GridLayout } from "./grid-layout";
import { Input } from "./input";
import { NumberInput } from "./number-input";
import { Radio } from "./radio";
import { Rate } from "./rate";
import { SectionCard } from "./section-card";
import { Select } from "./select";
import { Switch } from "./switch";
import { TagsInput } from "./tags-input";
import { Textarea } from "./textarea";

type RenderableComponent = React.ComponentType<any>;

interface BuilderComponentParam {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
  description?: string;
}

interface BuilderComponentMeta {
  label: string;
  value: BuilderComponentName;
  description: string;
  params: BuilderComponentParam[];
  meta: {
    fieldType: string;
  };
}

const BOOLEAN_FILTER_OPTIONS = [
  { label: "是", value: true },
  { label: "否", value: false },
] as const;

function withDefaultProps(
  Component: RenderableComponent,
  defaultProps: Record<string, unknown>,
): RenderableComponent {
  function Wrapped(props: Record<string, unknown>) {
    return React.createElement(Component, {
      ...defaultProps,
      ...props,
    });
  }

  Wrapped.displayName = `SceneMap(${Component.displayName ?? Component.name ?? "Anonymous"})`;
  return Wrapped;
}

const FilterSwitch = withDefaultProps(Select, { dataSource: BOOLEAN_FILTER_OPTIONS });
const DetailArrayCards = withDefaultProps(ArrayCards, { disabled: true });
const DetailEditableTable = withDefaultProps(EditableTable, { disabled: true });

export const FormComponentsMap: Record<BuilderComponentName, RenderableComponent> = {
  Input,
  Textarea,
  NumberInput,
  Select,
  Switch,
  DateInput,
  Radio,
  CheckboxGroup,
  Rate,
  TagsInput,
  SectionCard,
  GridLayout,
  FlexLayout,
  ArrayCards,
  EditableTable,
};

export const FilterComponentsMap: Partial<Record<BuilderComponentName, RenderableComponent>> = {
  Input,
  Textarea: Input,
  NumberInput,
  Select,
  Switch: FilterSwitch,
  DateInput,
  Radio,
  CheckboxGroup,
  Rate,
  TagsInput,
  SectionCard,
  GridLayout,
  FlexLayout,
};

export const DetailComponentsMap: Record<BuilderComponentName, RenderableComponent> = {
  Input: DisplayText,
  Textarea: DisplayText,
  NumberInput: DisplayText,
  Select: DisplayChoice,
  Switch: DisplayBoolean,
  DateInput: DisplayDate,
  Radio: DisplayChoice,
  CheckboxGroup: DisplayChoice,
  Rate: DisplayRate,
  TagsInput: DisplayTags,
  SectionCard,
  GridLayout,
  FlexLayout,
  ArrayCards: DetailArrayCards,
  EditableTable: DetailEditableTable,
};

export const TableComponentsMap: Partial<Record<BuilderComponentName, RenderableComponent>> = {
  Input: DisplayText,
  Textarea: DisplayText,
  NumberInput: DisplayText,
  Select: DisplayChoice,
  Switch: DisplayBoolean,
  DateInput: DisplayDate,
  Radio: DisplayChoice,
  CheckboxGroup: DisplayChoice,
  Rate: DisplayRate,
  TagsInput: DisplayTags,
};

function getDefaultBuilderComponent(
  fieldType?: BuilderFieldType | "void" | string,
): BuilderComponentName | undefined {
  switch (fieldType) {
    case "string":
      return "Input";
    case "number":
      return "NumberInput";
    case "boolean":
      return "Switch";
    case "array":
      return "ArrayCards";
    case "object":
    case "void":
      return "SectionCard";
    case "tags":
      return "TagsInput";
    default:
      return undefined;
  }
}

export function resolveSchemaComponent(
  componentName?: string,
  fieldType?: BuilderFieldType | "void" | string,
): BuilderComponentName | undefined {
  if (componentName && componentName in FormComponentsMap) {
    return componentName as BuilderComponentName;
  }
  return getDefaultBuilderComponent(fieldType);
}

const COMPONENT_OPTION_ORDER = [
  "Input",
  "Textarea",
  "NumberInput",
  "Select",
  "Switch",
  "DateInput",
  "Radio",
  "CheckboxGroup",
  "Rate",
  "TagsInput",
  "SectionCard",
  "GridLayout",
  "FlexLayout",
  "ArrayCards",
  "EditableTable",
] as const;

const componentOrderMap = new Map<string, number>(
  COMPONENT_OPTION_ORDER.map((key, index) => [key, index]),
);

function sortBuilderComponentOptions<T extends { value: string }>(items: T[]) {
  return items.sort((left, right) => {
    const leftRank = componentOrderMap.get(left.value) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = componentOrderMap.get(right.value) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.value.localeCompare(right.value);
  });
}

function normalizeBuilderFieldType(fieldType: BuilderFieldType) {
  return fieldType === "void" ? "object" : fieldType;
}

const builderComponents = sortBuilderComponentOptions<BuilderComponentMeta>([
  {
    label: "文本输入",
    value: "Input",
    description: "基础文本输入组件。",
    params: [],
    meta: { fieldType: "string" },
  },
  {
    label: "多行文本",
    value: "Textarea",
    description: "多行文本输入组件。",
    params: [],
    meta: { fieldType: "string" },
  },
  {
    label: "数字输入",
    value: "NumberInput",
    description: "数字输入组件。",
    params: [],
    meta: { fieldType: "number" },
  },
  {
    label: "下拉选择组件",
    value: "Select",
    description: "下拉选择组件。",
    params: [],
    meta: { fieldType: "string" },
  },
  {
    label: "开关",
    value: "Switch",
    description: "布尔开关组件。",
    params: [],
    meta: { fieldType: "boolean" },
  },
  {
    label: "选择日期",
    value: "DateInput",
    description: "日期输入组件。",
    params: [],
    meta: { fieldType: "string" },
  },
  {
    label: "单选组件",
    value: "Radio",
    description: "单选组件。",
    params: [],
    meta: { fieldType: "string" },
  },
  {
    label: "多选组件",
    value: "CheckboxGroup",
    description: "多选组件。",
    params: [],
    meta: { fieldType: "tags" },
  },
  {
    label: "评分组件",
    value: "Rate",
    description: "评分组件。",
    params: [],
    meta: { fieldType: "number" },
  },
  {
    label: "标签输入",
    value: "TagsInput",
    description: "标签输入组件，基于 Select 的 tags 模式。",
    params: [],
    meta: { fieldType: "tags" },
  },
  {
    label: "SectionCard",
    value: "SectionCard",
    description: "分组卡片容器组件。",
    params: [],
    meta: { fieldType: "object" },
  },
  {
    label: "栅格布局",
    value: "GridLayout",
    description: "基于栅格的容器布局组件。",
    params: [],
    meta: { fieldType: "object" },
  },
  {
    label: "弹性布局",
    value: "FlexLayout",
    description: "基于 Flex 的容器布局组件。",
    params: [],
    meta: { fieldType: "object" },
  },
  {
    label: "ArrayCards",
    value: "ArrayCards",
    description: "对象数组卡片编辑组件。",
    params: [],
    meta: { fieldType: "array" },
  },
  {
    label: "可编辑表格",
    value: "EditableTable",
    description: "对象数组表格编辑组件。",
    params: [],
    meta: { fieldType: "array" },
  },
]);

const builderComponentMetaMap = new Map<BuilderComponentName, BuilderComponentMeta>(
  builderComponents.map((item) => [item.value, item]),
);

export function getBuilderComponentMeta(componentName?: BuilderComponentName) {
  if (!componentName) {
    return undefined;
  }
  return builderComponentMetaMap.get(componentName);
}

function isBuilderCompatibleComponent(
  fieldType: BuilderFieldType,
  componentName: BuilderComponentName,
) {
  const component = getBuilderComponentMeta(componentName);
  const componentFieldType = component?.meta?.fieldType;
  if (!component || typeof componentFieldType !== "string") {
    return false;
  }

  if (fieldType === "array") {
    return componentFieldType === "array";
  }

  return componentFieldType === normalizeBuilderFieldType(fieldType);
}

export function getBuilderComponentOptions(fieldType: BuilderFieldType) {
  return builderComponents.filter((item) => isBuilderCompatibleComponent(fieldType, item.value));
}

export const builderComponentOptions = builderComponents;
