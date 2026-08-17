import type { IFieldSchema } from "@alien-form/core";
import {
  createAdapterCatalog,
  getSceneVariant,
  type AdapterCatalogItem,
  type AdapterScene,
  type DefinedAdapter,
  type SceneMode,
} from "./adapter";

export interface SceneRenderOverride {
  componentKey?: string;
  mode?: SceneMode;
  props?: Record<string, unknown>;
  operator?: string;
  summary?: boolean;
}

export interface ResolvedSceneRender {
  componentKey: string;
  mode: SceneMode;
  props: Record<string, unknown>;
  operator?: string;
  summary?: boolean;
  trace: string[];
}

export function defaultMode(scene: AdapterScene): SceneMode {
  switch (scene) {
    case "form":
      return "edit";
    case "filter":
      return "filter";
    case "detail":
      return "readonly";
    case "table":
      return "cell";
  }
}

function defaultComponentByType(type: IFieldSchema["type"]): string | undefined {
  switch (type) {
    case "string":
      return "Input";
    case "number":
      return "NumberInput";
    case "boolean":
      return "Switch";
    case "array":
      return "ArrayCards";
    case "object":
      return "SectionCard";
    case "tags":
      return "TagsInput";
    default:
      return undefined;
  }
}

/**
 * Resolves a core field schema for one render scene. Business projections can
 * pass scene-specific values through override without extending the schema.
 */
export function resolveSceneRender(
  field: IFieldSchema,
  scene: AdapterScene,
  catalog: AdapterCatalogItem[],
  override: SceneRenderOverride = {},
): ResolvedSceneRender | undefined {
  const trace: string[] = [];
  let startKey = field.component ?? field["x-layout"];

  if (startKey) {
    trace.push(`start=${startKey} (${field.component ? "field.component" : "field.x-layout"})`);
  } else {
    startKey = defaultComponentByType(field.type);
    if (!startKey) return undefined;
    trace.push(`start=${startKey} (type[${field.type ?? "?"}])`);
  }

  const adapter = catalog.find((item) => item.key === startKey);
  if (!adapter) return undefined;

  const variant = getSceneVariant(adapter.scenes[scene]);
  if (!variant) return undefined;

  let componentKey = variant.renderAs ?? startKey;
  if (variant.renderAs) {
    trace.push(`${startKey} --renderAs[${scene}]--> ${variant.renderAs}`);
  }
  if (override.componentKey) {
    componentKey = override.componentKey;
    trace.push(`override=${override.componentKey}`);
  }

  return {
    componentKey,
    mode: override.mode ?? variant.mode ?? defaultMode(scene),
    props: {
      ...variant.props,
      ...field.props,
      ...override.props,
    },
    operator: override.operator ?? variant.operator,
    summary: override.summary ?? variant.summary,
    trace,
  };
}

export function buildSceneComponents<TComponent>(
  scene: AdapterScene,
  catalog: AdapterCatalogItem[],
  componentMap: Record<string, TComponent>,
  wrap?: (component: TComponent, mode: SceneMode, props: Record<string, unknown>) => TComponent,
): Record<string, TComponent> {
  const result: Record<string, TComponent> = {};

  for (const item of catalog) {
    const variant = getSceneVariant(item.scenes[scene]);
    if (!variant) continue;

    const targetComponent = componentMap[variant.renderAs ?? item.key];
    if (targetComponent === undefined) continue;

    result[item.key] = wrap
      ? wrap(targetComponent, variant.mode ?? defaultMode(scene), variant.props ?? {})
      : targetComponent;
  }

  return result;
}

export function buildScenes<TComponent = unknown>(
  adapters: Record<string, unknown>,
  scene: AdapterScene,
  wrap?: (component: TComponent, mode: SceneMode, props: Record<string, unknown>) => TComponent,
): Record<string, TComponent> {
  const filtered: Record<string, DefinedAdapter<any, any>> = {};
  const componentMap: Record<string, TComponent> = {};

  for (const value of Object.values(adapters)) {
    if (typeof value !== "function") continue;
    const config = (value as { config?: { key?: unknown } }).config;
    if (!config || typeof config.key !== "string") continue;
    if (Object.prototype.hasOwnProperty.call(filtered, config.key)) continue;
    filtered[config.key] = value as DefinedAdapter<any, any>;
    componentMap[config.key] = value as unknown as TComponent;
  }

  return buildSceneComponents(scene, createAdapterCatalog(filtered), componentMap, wrap);
}
