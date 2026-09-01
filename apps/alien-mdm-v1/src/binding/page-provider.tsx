import { createContext, useContext, useEffect, type PropsWithChildren } from "react";
import type { PageRuntime } from "@engine";

const PageContext = createContext<PageRuntime | null>(null);

export function PageProvider({ page, children }: PropsWithChildren<{ page: PageRuntime }>) {
  useEffect(() => {
    page.mount();
    return () => page.destroy();
  }, [page]);
  return <PageContext.Provider value={page}>{children}</PageContext.Provider>;
}

export function usePage(): PageRuntime {
  const page = useContext(PageContext);
  if (!page) throw new Error("PageProvider is missing");
  return page;
}
