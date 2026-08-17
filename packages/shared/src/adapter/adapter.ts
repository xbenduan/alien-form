export interface AdapterParam {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
  description?: string;
}

export type AdapterKind = "component" | "decorator" | "display" | "utility";

export type AdapterScene = "form" | "detail" | "filter" | "table";

export type SceneMode = "edit" | "readonly" | "cell" | "filter";

export interface SceneVariant {
  mode?: SceneMode;
  renderAs?: string;
  props?: Record<string, unknown>;
  operator?: string;
  summary?: boolean;
}

export type SceneEntry = string | SceneVariant;
export type SceneMap = Partial<Record<AdapterScene, SceneEntry>>;

export function getSceneVariant(entry: SceneEntry | undefined): SceneVariant | undefined {
  if (entry === undefined) return undefined;
  return typeof entry === "string" ? { renderAs: entry } : entry;
}

type AnyAdapter = (...args: any[]) => any;

export interface AdapterConfig<TMeta extends Record<string, unknown> = Record<string, unknown>> {
  key: string;
  label: string;
  description: string;
  kind: AdapterKind;
  scenes: SceneMap;
  meta?: TMeta;
  params?: AdapterParam[];
}

export type DefinedAdapter<
  TAdapter extends AnyAdapter,
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> = TAdapter & {
  config: AdapterConfig<TMeta>;
};

export interface AdapterCatalogItem<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> {
  name: string;
  key: string;
  label: string;
  description: string;
  kind: AdapterKind;
  scenes: SceneMap;
  meta: TMeta;
  params: AdapterParam[];
}

type InferAdapterMeta<TAdapter> =
  TAdapter extends DefinedAdapter<any, infer TMeta> ? TMeta : Record<string, unknown>;

export function defineAdapters<
  TAdapter extends AnyAdapter,
  TMeta extends Record<string, unknown> = Record<string, unknown>,
>(adapter: TAdapter, config: AdapterConfig<TMeta>): DefinedAdapter<TAdapter, TMeta> {
  const defined = adapter as DefinedAdapter<TAdapter, TMeta>;
  defined.config = config;
  return defined;
}

export const defineAdapter = defineAdapters;

function readAdapterConfig(name: string, adapter: unknown): AdapterConfig<Record<string, unknown>> {
  if (
    typeof adapter !== "function" ||
    !("config" in adapter) ||
    !adapter.config ||
    typeof adapter.config !== "object"
  ) {
    throw new Error(`Adapter "${name}" is missing config.`);
  }
  return adapter.config as AdapterConfig<Record<string, unknown>>;
}

export function createAdapterRegistry<
  TAdapters extends Record<string, DefinedAdapter<AnyAdapter, any>>,
>(adapters: TAdapters): TAdapters {
  const keySet = new Set<string>();

  for (const [name, adapter] of Object.entries(adapters)) {
    const config = readAdapterConfig(name, adapter);
    const key = config.key;
    if (!key) {
      throw new Error(`Adapter "${name}" is missing config.key.`);
    }
    if (keySet.has(key)) {
      throw new Error(`Duplicate adapter key "${key}".`);
    }
    if (name !== key) {
      throw new Error(`Adapter export "${name}" does not match config.key "${key}".`);
    }
    keySet.add(key);
  }

  return adapters;
}

export function createAdapterCatalog<
  TAdapters extends Record<string, DefinedAdapter<AnyAdapter, any>>,
>(adapters: TAdapters): Array<AdapterCatalogItem<InferAdapterMeta<TAdapters[keyof TAdapters]>>> {
  return Object.entries(createAdapterRegistry(adapters)).map(([name, adapter]) => {
    const config = adapter.config;
    return {
      name,
      key: config.key,
      label: config.label,
      description: config.description,
      kind: config.kind,
      scenes: config.scenes,
      meta: (config.meta ?? {}) as InferAdapterMeta<TAdapters[keyof TAdapters]>,
      params: config.params ?? [],
    };
  });
}
