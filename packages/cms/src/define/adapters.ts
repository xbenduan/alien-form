export interface AdapterParam {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
  description?: string;
}

export type AdapterKind = "component" | "decorator" | "display" | "utility";

export type AdapterScene =
  | "recordForm"
  | "recordDetail"
  | "recordFilter"
  | "tableCell"
  | "builder";

type AnyAdapter = (...args: any[]) => any;

export interface AdapterConfig<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
  TScene extends AdapterScene = AdapterScene,
> {
  key: string;
  label: string;
  description: string;
  kind: AdapterKind;
  scenes: TScene[];
  meta?: TMeta;
  params?: AdapterParam[];
}

export type DefinedAdapter<
  TAdapter extends AnyAdapter,
  TMeta extends Record<string, unknown> = Record<string, unknown>,
  TScene extends AdapterScene = AdapterScene,
> = TAdapter & {
  config: AdapterConfig<TMeta, TScene>;
};

export interface AdapterCatalogItem<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
  TScene extends AdapterScene = AdapterScene,
> {
  name: string;
  key: string;
  label: string;
  description: string;
  kind: AdapterKind;
  scenes: TScene[];
  meta: TMeta;
  params: AdapterParam[];
}

type InferAdapterMeta<TAdapter> = TAdapter extends DefinedAdapter<any, infer TMeta, any>
  ? TMeta
  : Record<string, unknown>;

type InferAdapterScene<TAdapter> = TAdapter extends DefinedAdapter<any, any, infer TScene>
  ? TScene
  : AdapterScene;

export function defineAdapters<
  TAdapter extends AnyAdapter,
  TMeta extends Record<string, unknown> = Record<string, unknown>,
  TScene extends AdapterScene = AdapterScene,
>(
  component: TAdapter,
  config: AdapterConfig<TMeta, TScene>,
): DefinedAdapter<TAdapter, TMeta, TScene> {
  const adapter = component as DefinedAdapter<TAdapter, TMeta, TScene>;
  adapter.config = config;
  return adapter;
}

export const defineAdapter = defineAdapters;

export function createAdapterRegistry<
  TAdapters extends Record<string, DefinedAdapter<AnyAdapter, Record<string, unknown>, AdapterScene>>,
>(adapters: TAdapters): TAdapters {
  const keySet = new Set<string>();

  for (const [name, adapter] of Object.entries(adapters)) {
    const key = adapter.config.key;
    if (!key) {
      throw new Error(`Adapter "${name}" is missing config.key.`);
    }
    if (name !== key) {
      throw new Error(`Adapter export "${name}" does not match config.key "${key}".`);
    }
    if (keySet.has(key)) {
      throw new Error(`Duplicate adapter key "${key}".`);
    }
    keySet.add(key);
  }

  return adapters;
}

export function createAdapterCatalog<
  TAdapters extends Record<string, DefinedAdapter<AnyAdapter, Record<string, unknown>, AdapterScene>>,
>(
  adapters: TAdapters,
): Array<AdapterCatalogItem<InferAdapterMeta<TAdapters[keyof TAdapters]>, InferAdapterScene<TAdapters[keyof TAdapters]>>> {
  return Object.entries(createAdapterRegistry(adapters)).map(([name, adapter]) => {
    const config = adapter.config;
    return {
      name,
      key: config.key,
      label: config.label,
      description: config.description,
      kind: config.kind,
      scenes: config.scenes as InferAdapterScene<TAdapters[keyof TAdapters]>[],
      meta: (config.meta ?? {}) as InferAdapterMeta<TAdapters[keyof TAdapters]>,
      params: config.params ?? [],
    };
  });
}
