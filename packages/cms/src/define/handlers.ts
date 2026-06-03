import type { BuilderReactionTarget } from "../types/builder";

export interface HandlerParam {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
  description?: string;
}

export interface HandlerConfig<
  TDefaultConfig extends Record<string, unknown> = Record<string, unknown>,
  TTarget extends BuilderReactionTarget = BuilderReactionTarget,
> {
  key: string;
  label: string;
  description: string;
  supportedTargets: TTarget[];
  defaultConfig: TDefaultConfig;
  params?: HandlerParam[];
}

type AnyHandler = (...args: any[]) => any;

export type DefinedHandler<
  THandler extends AnyHandler,
  TDefaultConfig extends Record<string, unknown> = Record<string, unknown>,
  TTarget extends BuilderReactionTarget = BuilderReactionTarget,
> = THandler & {
  config: HandlerConfig<TDefaultConfig, TTarget>;
};

export interface DefineHandlerProps<
  THandler extends AnyHandler,
  TDefaultConfig extends Record<string, unknown> = Record<string, unknown>,
  TTarget extends BuilderReactionTarget = BuilderReactionTarget,
> {
  function: THandler;
  config: HandlerConfig<TDefaultConfig, TTarget>;
}

export interface HandlerCatalogItem<
  TDefaultConfig extends Record<string, unknown> = Record<string, unknown>,
  TTarget extends BuilderReactionTarget = BuilderReactionTarget,
> {
  name: string;
  key: string;
  label: string;
  description: string;
  supportedTargets: TTarget[];
  defaultConfig: TDefaultConfig;
  params: HandlerParam[];
}

type InferHandlerDefaultConfig<THandler> = THandler extends DefinedHandler<any, infer TDefaultConfig, any>
  ? TDefaultConfig
  : Record<string, unknown>;

type InferHandlerTarget<THandler> = THandler extends DefinedHandler<any, any, infer TTarget>
  ? TTarget
  : BuilderReactionTarget;

export function defineHandlers<
  THandler extends AnyHandler,
  TDefaultConfig extends Record<string, unknown> = Record<string, unknown>,
  TTarget extends BuilderReactionTarget = BuilderReactionTarget,
>(props: DefineHandlerProps<THandler, TDefaultConfig, TTarget>): DefinedHandler<THandler, TDefaultConfig, TTarget> {
  const handler = props.function as DefinedHandler<THandler, TDefaultConfig, TTarget>;
  handler.config = props.config;
  return handler;
}

export const defineHandler = defineHandlers;

export function createHandlerRegistry<
  THandlers extends Record<string, DefinedHandler<AnyHandler, Record<string, unknown>, BuilderReactionTarget>>,
>(handlers: THandlers): THandlers {
  const keySet = new Set<string>();

  for (const [name, handler] of Object.entries(handlers)) {
    const key = handler.config.key;
    if (!key) {
      throw new Error(`Handler "${name}" is missing config.key.`);
    }
    if (name !== key) {
      throw new Error(`Handler export "${name}" does not match config.key "${key}".`);
    }
    if (keySet.has(key)) {
      throw new Error(`Duplicate handler key "${key}".`);
    }
    keySet.add(key);
  }

  return handlers;
}

export function createHandlerCatalog<
  THandlers extends Record<string, DefinedHandler<AnyHandler, Record<string, unknown>, BuilderReactionTarget>>,
>(
  handlers: THandlers,
): Array<HandlerCatalogItem<InferHandlerDefaultConfig<THandlers[keyof THandlers]>, InferHandlerTarget<THandlers[keyof THandlers]>>> {
  return Object.entries(createHandlerRegistry(handlers)).map(([name, handler]) => {
    const config = handler.config;
    return {
      name,
      key: config.key,
      label: config.label,
      description: config.description,
      supportedTargets: config.supportedTargets as InferHandlerTarget<THandlers[keyof THandlers]>[],
      defaultConfig: config.defaultConfig as InferHandlerDefaultConfig<THandlers[keyof THandlers]>,
      params: config.params ?? [],
    };
  });
}
