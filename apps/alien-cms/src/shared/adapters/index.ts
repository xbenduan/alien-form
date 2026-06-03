import React from "react";
import type { BuilderComponentName, BuilderFieldType, CmsFieldSchema } from "@alien-form/cms";
import { createAdapterCatalog, createAdapterRegistry } from "@alien-form/cms";

type AdapterValue = ((...args: any[]) => any) & {
  config: {
    key: string;
    label: string;
    kind: string;
    scenes: string[];
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
  "ArrayCards",
] as const;

const componentOrderMap = new Map<string, number>(
  COMPONENT_OPTION_ORDER.map((key, index) => [key, index]),
);

function isAdapterModule(value: unknown): value is AdapterModule {
  return value !== null && typeof value === "object" && "default" in value;
}

function buildSceneMap(scene: string, kind: string) {
  return Object.fromEntries(
    registry
      .filter((item) => item.kind === kind && item.scenes.includes(scene as never))
      .map((item) => [item.key, map[item.key as keyof typeof map]]),
  );
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
  arrayMode?: "tags" | "object",
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
    return arrayMode === "object" ? componentName === "ArrayCards" : componentName !== "ArrayCards";
  }

  return componentFieldType === normalizeBuilderFieldType(fieldType);
}

export function getBuilderComponentOptions(
  fieldType: BuilderFieldType,
  arrayMode?: "tags" | "object",
) {
  return componentCatalog.filter((item) =>
    isBuilderCompatibleComponent(fieldType, item.value, arrayMode),
  );
}

export const options = componentCatalog
  .map((item) => ({
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

export const recordFormComponents = buildSceneMap("recordForm", "component");

export const recordFormDecorators = buildSceneMap("recordForm", "decorator");

export const filterFormComponents = {
  ...buildSceneMap("recordFilter", "component"),
  Textarea: map.Input,
  Switch: map.Select,
};

export const filterFormDecorators = buildSceneMap("recordFilter", "decorator");

export const detailFieldDisplayComponents = {
  Input: map.DisplayText,
  Textarea: map.DisplayText,
  NumberInput: map.DisplayText,
  Select: map.DisplayChoice,
  Switch: map.DisplayBoolean,
  DateInput: map.DisplayDate,
  Radio: map.DisplayChoice,
  CheckboxGroup: map.DisplayChoice,
  Rate: map.DisplayRate,
  TagsInput: map.DisplayTags,
};

function isObjectItemsArray(field: Pick<CmsFieldSchema, "type" | "items">) {
  return (
    field.type === "array" &&
    Boolean(field.items) &&
    !Array.isArray(field.items) &&
    typeof field.items === "object" &&
    "type" in field.items &&
    field.items.type === "object"
  );
}

export function canUseSharedDisplayComponent(
  field: Pick<CmsFieldSchema, "type" | "component" | "items">,
) {
  if (field.type === "object" || field.type === "void") {
    return false;
  }

  if (isObjectItemsArray(field)) {
    return false;
  }

  if (!field.component) {
    return field.type !== "array";
  }

  return field.component in detailFieldDisplayComponents;
}

function ReadonlyArrayCards(props: Record<string, unknown>) {
  const ArrayCards = map.ArrayCards;
  return React.createElement(ArrayCards as never, {
    ...props,
    disabled: true,
  });
}

export const detailFormComponents = {
  ...detailFieldDisplayComponents,
  ArrayCards: ReadonlyArrayCards,
  SectionCard: map.SectionCard,
};
