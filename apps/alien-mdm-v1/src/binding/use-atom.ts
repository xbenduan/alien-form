import { effect } from "@alien-form/core";
import { useCallback, useSyncExternalStore } from "react";

export function useAtom<T>(atom: () => T): T {
  const subscribe = useCallback(
    (notify: () => void) => {
      let initialized = false;
      return effect(() => {
        atom();
        if (initialized) notify();
        initialized = true;
      });
    },
    [atom],
  );
  return useSyncExternalStore(subscribe, atom, atom);
}
