import { useCallback, useSyncExternalStore } from "react";
import { effect } from "alien-signals";

export interface ReadonlyLike<T> {
  get(): T;
  subscribe(fn: (value: T) => void): () => void;
}

type SubscribeFn<T> = {
  (): T;
  (value: T): void;
};

function isAtomLike<T>(source: unknown): source is ReadonlyLike<T> {
  return typeof source === "object" && source !== null && "get" in source && "subscribe" in source;
}

export function useAtom<T>(source: SubscribeFn<T> | ReadonlyLike<T>): T {
  const getSnapshot = useCallback(() => {
    if (isAtomLike<T>(source)) return source.get();
    return (source as () => T)();
  }, [source]);

  const subscribe = useCallback(
    (notify: () => void) => {
      if (isAtomLike<T>(source)) {
        return source.subscribe(() => notify());
      }
      let first = true;
      return effect(() => {
        (source as () => T)();
        if (!first) notify();
        first = false;
      });
    },
    [source],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
