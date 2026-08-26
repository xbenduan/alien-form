import { createContext, useContext } from "react";
import type { PropsWithChildren } from "react";
import type { Runtime } from "../core/runtime/runtime";
import type { PageRuntime } from "../core/page/runtime";
import type { BlockRuntime } from "../core/page/block";

const RuntimeContext = createContext<Runtime | null>(null);
const PageContext = createContext<PageRuntime | null>(null);
const BlockContext = createContext<BlockRuntime | null>(null);
const NodeContext = createContext<{ slots?: Record<string, unknown[]> } | null>(null);

export function RuntimeProvider({ runtime, children }: PropsWithChildren<{ runtime: Runtime }>) {
  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}

export function PageProvider({ page, children }: PropsWithChildren<{ page: PageRuntime }>) {
  return <PageContext.Provider value={page}>{children}</PageContext.Provider>;
}

export function BlockProvider({ block, children }: PropsWithChildren<{ block: BlockRuntime }>) {
  return <BlockContext.Provider value={block}>{children}</BlockContext.Provider>;
}

export function useRuntime(): Runtime {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error("[alien-page] useRuntime must be used within <RuntimeProvider>");
  return ctx;
}

export function usePage(): PageRuntime {
  const ctx = useContext(PageContext);
  if (!ctx) throw new Error("[alien-page] usePage must be used within <PageProvider>");
  return ctx;
}

export function useOptionalPage(): PageRuntime | null {
  return useContext(PageContext);
}

export function useBlockContext(): BlockRuntime | null {
  return useContext(BlockContext);
}

export function useNodeSlots<T = unknown>(): Record<string, T[]> | undefined {
  return useContext(NodeContext)?.slots as Record<string, T[]> | undefined;
}

export { NodeContext, RuntimeContext, PageContext, BlockContext };
