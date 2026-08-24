import { createContext, useContext } from "react";
import type { PropsWithChildren } from "react";
import { RuntimeCore } from "./RuntimeCore";

const RuntimeContext = createContext<RuntimeCore | null>(null);

export function RuntimeProvider({ children }: PropsWithChildren) {
  return <RuntimeContext.Provider value={RuntimeCore.current}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): RuntimeCore {
  return useContext(RuntimeContext) ?? RuntimeCore.current;
}

export function useScope(domain?: string): Record<string, unknown> {
  return useRuntime().scope(domain);
}
