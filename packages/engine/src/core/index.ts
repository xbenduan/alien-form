export { Runtime, createRuntime, type RuntimeOptions } from "./runtime";
export type {
  ComponentDescriptor,
  FormRegistry,
  FunctionDescriptor,
  Registry,
  ServiceContext,
  ServiceDescriptor,
} from "./registry";
export { RegistryNamespace, createRegistry } from "./registry";

export { AtomStore, type Atom, type ReadonlyAtom } from "./store";

export { PageBus } from "./bus/page-bus";
export { SharedShelf } from "./bus/shelf";

export type { RouteLocation, RouteNavigateTarget, NavigationGuard, RouterAdapter } from "./router";
export { MemoryRouterAdapter } from "./router";

export {
  SchemaTranslator,
  PageCompiler,
  collectMarkers,
  getPath,
  setPath,
  deletePath,
  type FoundMarker,
  type TranslateCtx,
  type ResolveCtx,
  type TranslatorPlugin,
} from "./compiler";

export { i18nPlugin, constantPlugin } from "./plugins";

export {
  PageRuntime,
  BlockRuntime,
  createBlock,
  ListBlockRuntime,
  FormBlockRuntime,
  DetailBlockRuntime,
  CustomBlockRuntime,
  type PageScope,
  type SorterState,
  type ListResult,
} from "./page";

export {
  isPluginMarker,
  type PluginMarker,
  type UiNode,
  type BlockType,
  type BlockSchema,
  type PageSchema,
  type CompiledPage,
} from "./dsl";

export { signal, computed, effect, startBatch, endBatch } from "alien-signals";
