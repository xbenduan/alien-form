import { createContext, useContext, type PropsWithChildren } from "react";
import type { Runtime } from "@engine";

const RuntimeContext = createContext<Runtime | null>(null);

export function RuntimeProvider({ runtime, children }: PropsWithChildren<{ runtime: Runtime }>) {
  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): Runtime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error("RuntimeProvider is missing");
  return runtime;
}
