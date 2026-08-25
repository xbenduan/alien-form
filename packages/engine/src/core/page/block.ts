import { effect } from "alien-signals";
import type { Atom, AtomStore } from "../store/atom";
import type { BlockSchema } from "../dsl";
import type { PageRuntime } from "./runtime";
import type { Runtime } from "../runtime/runtime";

export abstract class BlockRuntime {
  readonly name: string;
  readonly type: BlockSchema["type"];
  readonly page: PageRuntime;
  protected store: AtomStore;
  protected runtime: Runtime;
  private disposers: (() => void)[] = [];

  constructor(schema: BlockSchema, page: PageRuntime, store: AtomStore, runtime: Runtime) {
    this.name = schema.name;
    this.type = schema.type;
    this.page = page;
    this.store = store;
    this.runtime = runtime;
  }

  protected bridgeAtom<T>(key: string, initial: T): Atom<T> {
    return this.store.atom(`page:${this.page.id}.${this.name}.${key}`, initial);
  }

  protected bridge<T>(key: string, source: () => T): Atom<T> {
    const atom = this.bridgeAtom(key, source());
    const dispose = effect(() => atom.set(source()));
    this.disposers.push(dispose);
    return atom;
  }

  protected autoDispose(fn: () => void): void {
    this.disposers.push(fn);
  }

  mount(): void {}

  dispose(): void {
    this.disposers.forEach((d) => d());
    this.disposers = [];
  }
}
