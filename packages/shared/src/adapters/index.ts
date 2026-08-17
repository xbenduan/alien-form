import type { IFieldSchema } from "@alien-form/core";
import { createAdapterCatalog, createAdapterRegistry } from "../adapter";

import ArrayCardsAdapter from "./array-cards";
import CheckboxGroupAdapter from "./checkbox-group";
import DateInputAdapter from "./date-input";
import DisplayBooleanAdapter from "./display-boolean";
import DisplayChoiceAdapter from "./display-choice";
import DisplayDateAdapter from "./display-date";
import DisplayRateAdapter from "./display-rate";
import DisplayTagsAdapter from "./display-tags";
import DisplayTextAdapter from "./display-text";
import EditableTableAdapter from "./editable-table";
import FlexLayoutAdapter from "./flex-layout";
import getDisplaySummaryAdapter from "./get-display-summary";
import GridLayoutAdapter from "./grid-layout";
import InputAdapter from "./input";
import NumberInputAdapter from "./number-input";
import RadioAdapter from "./radio";
import RateAdapter from "./rate";
import SectionCardAdapter from "./section-card";
import SelectAdapter from "./select";
import SwitchAdapter from "./switch";
import TagsInputAdapter from "./tags-input";
import TextareaAdapter from "./textarea";

export {
  ArrayCardsAdapter,
  CheckboxGroupAdapter,
  DateInputAdapter,
  DisplayBooleanAdapter,
  DisplayChoiceAdapter,
  DisplayDateAdapter,
  DisplayRateAdapter,
  DisplayTagsAdapter,
  DisplayTextAdapter,
  EditableTableAdapter,
  FlexLayoutAdapter,
  getDisplaySummaryAdapter,
  GridLayoutAdapter,
  InputAdapter,
  NumberInputAdapter,
  RadioAdapter,
  RateAdapter,
  SectionCardAdapter,
  SelectAdapter,
  SwitchAdapter,
  TagsInputAdapter,
  TextareaAdapter,
};
export * from "./display-utils";

type AdapterValue = ((...args: any[]) => any) & {
  config: {
    key: string;
    label: string;
    kind: string;
    scenes: Record<string, unknown>;
  };
};

type AdapterModule = {
  default: AdapterValue;
};

const adapterModules: Record<string, AdapterModule> = {
  ArrayCardsAdapter: { default: ArrayCardsAdapter },
  CheckboxGroupAdapter: { default: CheckboxGroupAdapter },
  DateInputAdapter: { default: DateInputAdapter },
  DisplayBooleanAdapter: { default: DisplayBooleanAdapter },
  DisplayChoiceAdapter: { default: DisplayChoiceAdapter },
  DisplayDateAdapter: { default: DisplayDateAdapter },
  DisplayRateAdapter: { default: DisplayRateAdapter },
  DisplayTagsAdapter: { default: DisplayTagsAdapter },
  DisplayTextAdapter: { default: DisplayTextAdapter },
  EditableTableAdapter: { default: EditableTableAdapter },
  FlexLayoutAdapter: { default: FlexLayoutAdapter },
  getDisplaySummaryAdapter: { default: getDisplaySummaryAdapter },
  GridLayoutAdapter: { default: GridLayoutAdapter },
  InputAdapter: { default: InputAdapter },
  NumberInputAdapter: { default: NumberInputAdapter },
  RadioAdapter: { default: RadioAdapter },
  RateAdapter: { default: RateAdapter },
  SectionCardAdapter: { default: SectionCardAdapter },
  SelectAdapter: { default: SelectAdapter },
  SwitchAdapter: { default: SwitchAdapter },
  TagsInputAdapter: { default: TagsInputAdapter },
  TextareaAdapter: { default: TextareaAdapter },
};

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

function isAdapterModule(value: unknown): value is AdapterModule {
  return value !== null && typeof value === "object" && "default" in value;
}

const rawMap = Object.fromEntries(
  Object.values(adapterModules)
    .filter(isAdapterModule)
    .map((module) => [module.default.config.key, module.default]),
);

export const map = createAdapterRegistry(rawMap as any);

export const registry = createAdapterCatalog(map as any);

type ComponentCatalogItem = (typeof registry)[number] & {
  value: string;
};

function sortComponentCatalog<T extends { key: string }>(items: T[]) {
  return items.sort((left, right) => {
    const leftRank = componentOrderMap.get(left.key) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = componentOrderMap.get(right.key) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.key.localeCompare(right.key);
  });
}

export const componentCatalog: ComponentCatalogItem[] = sortComponentCatalog(
  registry
    .filter((item) => item.kind === "component")
    .map((item) => ({
      ...item,
      value: item.key,
    })),
);

export function getComponentMeta(componentName?: string) {
  if (!componentName) {
    return undefined;
  }
  return componentCatalog.find((item) => item.key === componentName);
}

export function isCompatibleComponent(fieldType: IFieldSchema["type"], componentName: string) {
  const component = getComponentMeta(componentName);
  const componentFieldType = component?.meta?.fieldType;
  if (!component || typeof componentFieldType !== "string") {
    return false;
  }

  if (fieldType === "array") {
    if (componentFieldType !== "array") {
      return false;
    }
    return true;
  }

  return componentFieldType === fieldType;
}

export function getComponentOptions(fieldType: IFieldSchema["type"]) {
  return componentCatalog.filter((item) => isCompatibleComponent(fieldType, item.value));
}

export const options = componentCatalog.map((item) => ({
  label: item.label,
  value: item.value,
}));

export const componentOptions = componentCatalog
  .filter((item) => item.kind === "component")
  .map((item) => ({
    label: item.label,
    value: item.value,
    description: item.description,
    params: item.params,
    meta: item.meta,
    scenes: item.scenes,
    kind: item.kind,
  }));
