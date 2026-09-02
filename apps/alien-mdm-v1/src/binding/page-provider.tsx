import { createContext, useContext, useEffect, type PropsWithChildren } from "react";
import type { PageRuntime } from "@engine";

const PageContext = createContext<PageRuntime | null>(null);
const lifecycleVersions = new WeakMap<PageRuntime, number>();

export function PageProvider({ page, children }: PropsWithChildren<{ page: PageRuntime }>) {
  useEffect(() => {
    const version = (lifecycleVersions.get(page) ?? 0) + 1;
    lifecycleVersions.set(page, version);
    page.mount();
    return () => {
      page.form.unmount();
      queueMicrotask(() => {
        if (lifecycleVersions.get(page) !== version) return;
        lifecycleVersions.delete(page);
        page.destroy();
      });
    };
  }, [page]);
  return <PageContext.Provider value={page}>{children}</PageContext.Provider>;
}

export function usePage(): PageRuntime {
  const page = useContext(PageContext);
  if (!page) throw new Error("PageProvider is missing");
  return page;
}
