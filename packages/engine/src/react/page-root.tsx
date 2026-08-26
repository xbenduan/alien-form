import { useEffect, useState } from "react";
import { signal } from "alien-signals";
import type { PageSchema } from "../core/dsl";
import type { PageRuntime } from "../core/page/runtime";
import type { RouteLocation } from "../core/router";
import { useRuntime, PageProvider } from "./context";
import { useAtom } from "./use-atom";
import { RenderNode } from "./renderer";

const fallbackLocation = signal<RouteLocation>({ path: "/", params: {}, query: {} });

export function PageRoot({ schema }: { schema: PageSchema }) {
  const runtime = useRuntime();
  const [page, setPage] = useState<PageRuntime | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdPage: PageRuntime | undefined;
    setPage(null);
    setError(null);
    runtime
      .createPage(schema)
      .then((p) => {
        createdPage = p;
        if (cancelled) {
          runtime.destroyPage(p);
          return;
        }
        p.mount();
        setPage(p);
      })
      .catch((e) => {
        if (!cancelled) setError(e as Error);
      });
    return () => {
      cancelled = true;
      if (createdPage) runtime.destroyPage(createdPage);
    };
  }, [schema, runtime]);

  if (error) {
    return <div style={{ color: "red", padding: 16 }}>Page Error: {error.message}</div>;
  }

  if (!page) {
    return <div style={{ padding: 16 }}>Loading...</div>;
  }

  return (
    <PageProvider page={page}>
      <PageRouterSync page={page} />
      <RenderNode node={page.compiled.layout} />
    </PageProvider>
  );
}

function PageRouterSync({ page }: { page: PageRuntime }) {
  const runtime = useRuntime();
  const routeSignal = runtime.router?.current ?? fallbackLocation;
  const location = useAtom(routeSignal);

  useEffect(() => {
    if (!runtime.router) return;
    page.routeParams.set(location.params);
    page.query.set(location.query);
  }, [location, page, runtime.router]);

  return null;
}
