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
