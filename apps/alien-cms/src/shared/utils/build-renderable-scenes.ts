import React from "react";
import { buildScenes, type AdapterScene, type SceneMode } from "@alien-form/cms";

type RenderableAdapter = React.ComponentType<any>;

type AdapterExport = {
  config?: {
    kind?: unknown;
  };
};

function isRenderableAdapter(value: unknown): value is RenderableAdapter & AdapterExport {
  if (typeof value !== "function") {
    return false;
  }

  const kind = (value as AdapterExport).config?.kind;
  return kind === "component" || kind === "display";
}

function withSceneMode(
  Component: RenderableAdapter,
  mode: SceneMode,
  defaultProps: Record<string, unknown>,
): RenderableAdapter {
  function SceneComponent(props: Record<string, unknown>) {
    return React.createElement(Component, { ...defaultProps, mode, ...props });
  }

  SceneComponent.displayName = `Scene(${Component.displayName ?? Component.name ?? "Anonymous"})`;
  return SceneComponent;
}

export function buildRenderableScenes<TAdapters extends object>(
  adapters: TAdapters,
  scene: AdapterScene,
): Record<string, RenderableAdapter> {
  const renderableAdapters = Object.fromEntries(
    Object.entries(adapters).filter(([, value]) => isRenderableAdapter(value)),
  );

  return buildScenes<RenderableAdapter>(renderableAdapters, scene, withSceneMode);
}
