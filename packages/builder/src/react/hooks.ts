import { useCallback, useSyncExternalStore } from "react";
import type { ReadonlyBuilderAtom } from "../core/types";
import { useBuilder } from "./context";

export function useBuilderAtom<T>(atom: ReadonlyBuilderAtom<T>): T {
  const subscribe = useCallback((notify: () => void) => atom.subscribe(notify), [atom]);
  const getSnapshot = useCallback(() => atom.get(), [atom]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useCommand<TPayload = unknown, TResult = unknown>(
  name: string,
): (payload: TPayload) => TResult {
  const builder = useBuilder();
  return useCallback(
    (payload: TPayload) => builder.dispatch(name, payload) as TResult,
    [builder, name],
  );
}
