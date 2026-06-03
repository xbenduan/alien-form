import React from "react";
import type { CmsFieldSchema } from "@alien-form/cms";
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

export const options = registry
  .filter((item) => item.kind === "component")
  .sort((left, right) => {
    const leftRank = componentOrderMap.get(left.key) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = componentOrderMap.get(right.key) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.key.localeCompare(right.key);
  })
  .map((item) => ({
    label: item.label,
    value: item.key,
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
