import { createContext, useContext, type PropsWithChildren } from "react";
import type { BuilderRuntime } from "../core/runtime";

const BuilderContext = createContext<BuilderRuntime<unknown> | null>(null);

export function BuilderProvider<TDocument>({
  builder,
  children,
}: PropsWithChildren<{ builder: BuilderRuntime<TDocument> }>) {
  return (
    <BuilderContext.Provider value={builder as BuilderRuntime<unknown>}>
      {children}
    </BuilderContext.Provider>
  );
}

export function useBuilder<TDocument = unknown>(): BuilderRuntime<TDocument> {
  const builder = useContext(BuilderContext);
  if (!builder) {
    throw new Error("[alien-builder] useBuilder must be used within <BuilderProvider>");
  }
  return builder as BuilderRuntime<TDocument>;
}
