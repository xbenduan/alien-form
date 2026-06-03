import type { BuilderReactionTarget } from "@alien-form/cms";
import { createHandlerCatalog, createHandlerRegistry } from "@alien-form/cms";

type HandlerValue = ((...args: any[]) => any) & {
  config: {
    key: string;
  };
};

type HandlerModule = {
  default: HandlerValue;
};

function isHandlerModule(value: unknown): value is HandlerModule {
  return value !== null && typeof value === "object" && "default" in value;
}

const handlerModules = import.meta.glob<HandlerModule>(
  ["./**/*.ts", "./**/*.tsx", "!./index.ts", "!./index.tsx", "!./record-handler-utils.ts"],
  { eager: true },
);

const rawMap = Object.fromEntries(
  Object.values(handlerModules)
    .filter(isHandlerModule)
    .map((module) => [module.default.config.key, module.default]),
);

export const map = createHandlerRegistry(rawMap as any);

export const registry = createHandlerCatalog(map as any);

export const handlerCatalog = registry.map((item) => ({
  ...item,
  value: item.name,
}));

export function getHandlerMeta(handlerName?: string) {
  if (!handlerName) {
    return undefined;
  }
  return handlerCatalog.find((item) => item.name === handlerName);
}

export function getHandlerOptions(target: BuilderReactionTarget) {
  return handlerCatalog.filter((item) => item.supportedTargets.includes(target));
}

export function getHandlerDefaultParamsText(handlerName?: string) {
  const handler = getHandlerMeta(handlerName);
  return handler ? JSON.stringify(handler.defaultConfig, null, 2) : "{}";
}
