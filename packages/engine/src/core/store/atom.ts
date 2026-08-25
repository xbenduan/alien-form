import {
  signal,
  computed,
  effect,
  startBatch,
  endBatch,
} from "alien-signals";

export type Signal<T> = {
  (): T;
  (value: T): void;
};

export interface ReadonlyAtom<T> {
  readonly key: string;
  get(): T;
  subscribe(fn: (value: T) => void): () => void;
}

export interface Atom<T> extends ReadonlyAtom<T> {
  set(value: T | ((prev: T) => T)): void;
  reset(): void;
}

class AtomImpl<T> implements Atom<T> {
  readonly key: string;
  readonly signal: Signal<T>;
  private readonly initial: T;

  constructor(key: string, initial: T) {
    this.key = key;
    this.initial = initial;
    this.signal = signal(initial);
  }

  get(): T {
    return this.signal();
  }

  set(value: T | ((prev: T) => T)): void {
    if (typeof value === "function") {
      this.signal((value as (prev: T) => T)(this.signal()));
    } else {
      this.signal(value);
    }
  }

  reset(): void {
    this.signal(this.initial);
  }

  subscribe(fn: (value: T) => void): () => void {
    let first = true;
    return effect(() => {
      const value = this.signal();
      if (!first) fn(value);
      first = false;
    });
  }
}

export class AtomStore {
  private atoms = new Map<string, AtomImpl<unknown>>();
  private observers = new Set<(key: string, value: unknown) => void>();

  atom<T>(key: string, initial: T): Atom<T> {
    const existing = this.atoms.get(key);
    if (existing) return existing as unknown as Atom<T>;
    const atom = new AtomImpl(key, initial);
    const originalSet = atom.set.bind(atom);
    atom.set = (value: T | ((prev: T) => T)) => {
      originalSet(value);
      this.observers.forEach((obs) => obs(key, atom.get()));
    };
    this.atoms.set(key, atom as unknown as AtomImpl<unknown>);
    return atom as unknown as Atom<T>;
  }

  derive<T>(key: string, compute: () => T): ReadonlyAtom<T> {
    const c = computed(compute);
    return {
      key,
      get: () => c(),
      subscribe(fn: (value: T) => void) {
        let first = true;
        return effect(() => {
          const value = c();
          if (!first) fn(value);
          first = false;
        });
      },
    };
  }

  batch(fn: () => void): void {
    startBatch();
    try {
      fn();
    } finally {
      endBatch();
    }
  }

  snapshot(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    this.atoms.forEach((atom, key) => {
      result[key] = atom.get();
    });
    return result;
  }

  restore(snapshot: Record<string, unknown>): void {
    this.batch(() => {
      for (const [key, value] of Object.entries(snapshot)) {
        this.atoms.get(key)?.set(value);
      }
    });
  }

  dispose(prefix: string): void {
    for (const key of this.atoms.keys()) {
      if (key.startsWith(prefix)) this.atoms.delete(key);
    }
  }

  has(key: string): boolean {
    return this.atoms.has(key);
  }

  observe(handler: (key: string, value: unknown) => void): () => void {
    this.observers.add(handler);
    return () => this.observers.delete(handler);
  }
}
