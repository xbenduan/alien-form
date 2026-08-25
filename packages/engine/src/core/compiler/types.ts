import type { PluginMarker } from "../dsl/marker";
import type { Runtime } from "../runtime/runtime";
import type { PageRuntime } from "../page/runtime";

export interface TranslateCtx {
  locale: string;
  runtime: Runtime;
  page?: PageRuntime;
  store: Record<string, unknown>;
}

export interface ResolveCtx extends TranslateCtx {
  path: (string | number)[];
  patch: (path: (string | number)[], value: unknown) => void;
}

export interface TranslatorPlugin {
  name: string;
  order?: number;
  prefetch?(marker: PluginMarker, ctx: TranslateCtx): Promise<void>;
  resolve(marker: PluginMarker, ctx: ResolveCtx): unknown | Promise<unknown>;
}
