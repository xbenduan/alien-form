import type { Atom, AtomStore } from "../store/atom";
import type { CompiledPage, PageSchema } from "../dsl";
import type { Runtime } from "../runtime/runtime";
import { createBlock, type BlockRuntime } from "./blocks";
import type { PageScope } from "./scope";

export class PageRuntime {
  /** 唯一运行时实例标识，供 Runtime 和 AtomStore 隔离并存页面。 */
  readonly instanceId: string;
  readonly id: string;
  readonly domain: string;
  readonly schema: PageSchema;
  readonly runtime: Runtime;
  readonly store: AtomStore;
  readonly compiled: CompiledPage;

  readonly routeParams: Atom<Record<string, string>>;
  readonly query: Atom<Record<string, string>>;
  readonly mounted: Atom<boolean>;

  private blocks = new Map<string, BlockRuntime>();
  private disposers: (() => void)[] = [];

  constructor(
    runtime: Runtime,
    compiled: CompiledPage,
    instanceId: string,
  ) {
    this.instanceId = instanceId;
    this.id = compiled.schema.id;
    this.domain = compiled.schema.domain;
    this.schema = compiled.schema;
    this.runtime = runtime;
    this.store = runtime.store;
    this.compiled = compiled;

    this.routeParams = this.store.atom(`page:${this.instanceId}._routeParams`, {});
    this.query = this.store.atom(`page:${this.instanceId}._query`, {});
    this.mounted = this.store.atom(`page:${this.instanceId}._mounted`, false);

    for (const blockSchema of compiled.schema.blocks) {
      const block = createBlock(
        blockSchema,
        this,
        this.store,
        runtime,
        compiled.blockOutputs[blockSchema.name],
      );
      this.blocks.set(blockSchema.name, block);
    }
  }

  block(name: string): BlockRuntime {
    const b = this.blocks.get(name);
    if (!b) throw new Error(`[alien-page] block "${name}" not found in page "${this.id}"`);
    return b;
  }

  get blocksProxy(): Record<string, BlockRuntime> {
    return new Proxy({} as Record<string, BlockRuntime>, {
      get: (_, name: string) => this.block(name),
    });
  }

  async service(code: string, params?: unknown): Promise<unknown> {
    const svc = this.runtime.registry.services.resolve(code, this.domain);
    if (!svc) throw new Error(`[alien-page] service "${code}" not registered`);
    return svc.send(params, { page: { id: this.id }, runtime: this.runtime });
  }

  fn(code: string, ...args: unknown[]): unknown {
    const fn = this.runtime.registry.functions.resolve(code, this.domain);
    if (!fn) throw new Error(`[alien-page] function "${code}" not registered`);
    return fn.handler(...args);
  }

  get scope(): PageScope {
    return {
      mode: typeof this.schema.meta?.mode === "string" ? this.schema.meta.mode : undefined,
      block: (name: string) => this.block(name),
      service: (code: string, params?: unknown) => this.service(code, params),
      fn: (code: string, ...args: unknown[]) => this.fn(code, ...args),
      constant: (key: string) => this.runtime.registry.constants.resolve(key, this.domain),
      params: this.routeParams.get(),
      query: this.query.get(),
    };
  }

  mount(): void {
    this.mounted.set(true);
    this.blocks.forEach((b) => b.mount());
  }

  unmount(): void {
    this.disposers.forEach((d) => d());
    this.disposers = [];
    this.blocks.forEach((b) => b.dispose());
    this.store.dispose(`page:${this.instanceId}`);
    this.mounted.set(false);
  }
}

export type PageRuntimeTypr = PageRuntime;
