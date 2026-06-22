import type { FilterOperator } from "../types/common";

export interface AdapterParam {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
  description?: string;
}

export type AdapterKind = "component" | "decorator" | "display" | "utility";

export type AdapterScene =
  | "form"
  | "detail"
  | "filter"
  | "table"
  | "builder";

export type SceneMode = "edit" | "readonly" | "cell" | "filter";

export interface SceneVariant {
  /** 该场景下组件渲染模式；缺省由 defaultMode(scene) 推导 */
  mode?: SceneMode;
  /** 委托给另一个 adapter key 渲染该场景（仅一跳委托） */
  renderAs?: string;
  /** 该场景注入的默认 props，优先级最低 */
  props?: Record<string, unknown>;
  /** 仅 filter 场景：默认操作符 */
  operator?: FilterOperator;
  /** 仅 table 场景：是否压缩为摘要 */
  summary?: boolean;
}

export type SceneEntry = string | SceneVariant;

export type SceneMap = Partial<Record<AdapterScene, SceneEntry>>;

/**
 * 把 SceneEntry 归一为 SceneVariant：字符串视为 { renderAs: <string> }。
 */
export function getSceneVariant(
  entry: SceneEntry | undefined,
): SceneVariant | undefined {
  if (entry === undefined) return undefined;
  if (typeof entry === "string") return { renderAs: entry };
  return entry;
}

type AnyAdapter = (...args: any[]) => any;

export interface AdapterConfig<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> {
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

type InferAdapterMeta<TAdapter> = TAdapter extends DefinedAdapter<any, infer TMeta>
  ? TMeta
  : Record<string, unknown>;

export function defineAdapters<
  TAdapter extends AnyAdapter,
  TMeta extends Record<string, unknown> = Record<string, unknown>,
>(
  component: TAdapter,
  config: AdapterConfig<TMeta>,
): DefinedAdapter<TAdapter, TMeta> {
  const adapter = component as DefinedAdapter<TAdapter, TMeta>;
  adapter.config = config;
  return adapter;
}

export const defineAdapter = defineAdapters;

export function createAdapterRegistry<
  TAdapters extends Record<string, DefinedAdapter<AnyAdapter, Record<string, unknown>>>,
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
  TAdapters extends Record<string, DefinedAdapter<AnyAdapter, Record<string, unknown>>>,
>(
  adapters: TAdapters,
): Array<AdapterCatalogItem<InferAdapterMeta<TAdapters[keyof TAdapters]>>> {
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
