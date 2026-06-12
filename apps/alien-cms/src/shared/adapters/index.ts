import React from "react";
import type {
  AdapterScene,
  BuilderComponentName,
  BuilderFieldType,
  SceneMode,
} from "@alien-form/cms";
import {
  buildSceneComponents,
  createAdapterCatalog,
  createAdapterRegistry,
} from "@alien-form/cms";

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

function withSceneMode<P extends Record<string, unknown>>(
  Component: (props: any) => React.ReactNode,
  mode: SceneMode,
  defaultProps: Record<string, unknown>,
) {
  function SceneComponent(props: P) {
    return React.createElement(Component as never, { ...defaultProps, mode, ...props });
  }
  return SceneComponent;
}

function sceneComponentsByKind(scene: AdapterScene, kinds: string[]) {
  const all = buildSceneComponents(
    scene,
    registry,
    map as Record<string, any>,
    withSceneMode,
  );
  const allowed = new Set(
    registry.filter((item) => kinds.includes(item.kind)).map((item) => item.key),
  );
  return Object.fromEntries(
    Object.entries(all).filter(([key]) => allowed.has(key)),
  );
}

export const recordFormComponents = sceneComponentsByKind("recordForm", [
  "component",
  "display",
]);

export const recordFormDecorators = sceneComponentsByKind("recordForm", ["decorator"]);

export const filterFormComponents = sceneComponentsByKind("recordFilter", [
  "component",
  "display",
]);

export const filterFormDecorators = sceneComponentsByKind("recordFilter", ["decorator"]);

export const detailFormComponents = sceneComponentsByKind("recordDetail", [
  "component",
  "display",
]);

export const detailFormDecorators = sceneComponentsByKind("recordDetail", ["decorator"]);
