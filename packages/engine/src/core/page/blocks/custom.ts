import type { Atom, AtomStore } from "../../store/atom";
import type { BlockSchema } from "../../dsl";
import { BlockRuntime } from "../block";
import type { PageRuntime } from "../runtime";
import type { Runtime } from "../../runtime/runtime";

export class CustomBlockRuntime extends BlockRuntime {
  private customs = new Map<string, Atom<unknown>>();

  constructor(schema: BlockSchema, page: PageRuntime, store: AtomStore, runtime: Runtime) {
    super(schema, page, store, runtime);
  }

  atom<T>(key: string, initial: T): Atom<T> {
    if (this.customs.has(key)) return this.customs.get(key) as Atom<T>;
    const atom = this.bridgeAtom(key, initial);
    this.customs.set(key, atom as Atom<unknown>);
    return atom;
  }
}
