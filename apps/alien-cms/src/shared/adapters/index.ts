import type {
  BuilderComponentName,
  BuilderFieldType,
} from "@alien-form/cms";
import {
  createAdapterCatalog,
  createAdapterRegistry,
} from "@alien-form/cms";

export { default as ArrayCardsAdapter } from "./array-cards";
export { default as CheckboxGroupAdapter } from "./checkbox-group";
export { default as DateInputAdapter } from "./date-input";
export { default as DisplayBooleanAdapter } from "./display-boolean";
export { default as DisplayChoiceAdapter } from "./display-choice";
export { default as DisplayDateAdapter } from "./display-date";
export { default as DisplayRateAdapter } from "./display-rate";
export { default as DisplayTagsAdapter } from "./display-tags";
export { default as DisplayTextAdapter } from "./display-text";
export * from "./display-utils";
export { default as EditableTableAdapter } from "./editable-table";
export { default as FlexLayoutAdapter } from "./flex-layout";
export { default as getDisplaySummaryAdapter } from "./get-display-summary";
export { default as GridLayoutAdapter } from "./grid-layout";
export { default as InputAdapter } from "./input";
export { default as NumberInputAdapter } from "./number-input";
export { default as RadioAdapter } from "./radio";
export { default as RateAdapter } from "./rate";
export { default as SectionCardAdapter } from "./section-card";
export { default as SelectAdapter } from "./select";
export { default as SwitchAdapter } from "./switch";
export { default as TagsInputAdapter } from "./tags-input";
export { default as TextareaAdapter } from "./textarea";

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

const adapterModules = import.meta.glob<AdapterModule>(
  ["./**/*.ts", "./**/*.tsx", "!./index.ts", "!./index.tsx"],
  { eager: true },
);

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
  value: BuilderComponentName;
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

function normalizeBuilderFieldType(fieldType: BuilderFieldType) {
  return fieldType === "void" ? "object" : fieldType;
}

export const componentCatalog: ComponentCatalogItem[] = sortComponentCatalog(
  registry
    .filter((item) => item.kind === "component")
    .map((item) => ({
      ...item,
      value: item.key as BuilderComponentName,
    })),
);

export function getBuilderComponentMeta(componentName?: BuilderComponentName) {
  if (!componentName) {
    return undefined;
  }
  return componentCatalog.find((item) => item.key === componentName);
}

export function isBuilderCompatibleComponent(
  fieldType: BuilderFieldType,
  componentName: BuilderComponentName,
) {
  const component = getBuilderComponentMeta(componentName);
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

  return componentFieldType === normalizeBuilderFieldType(fieldType);
}

export function getBuilderComponentOptions(fieldType: BuilderFieldType) {
  return componentCatalog.filter((item) => isBuilderCompatibleComponent(fieldType, item.value));
}

export const options = componentCatalog.map((item) => ({
  label: item.label,
  value: item.value,
}));

export const builderComponentOptions = componentCatalog
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
