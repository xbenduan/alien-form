import { signal } from "alien-signals";
import type {
  NavigationGuard,
  RouteLocation,
  RouteNavigateTarget,
  RouterAdapter,
} from "./types";

function parsePath(path: string): RouteLocation {
  const [rawPath, rawQuery = ""] = path.split("?");
  const query: Record<string, string> = {};
  for (const pair of rawQuery.split("&")) {
    if (!pair) continue;
    const [k, v = ""] = pair.split("=");
    query[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return { path: rawPath || "/", params: {}, query };
}

type SignalLike<T> = {
  (): T;
  (value: T): void;
};

export class MemoryRouterAdapter implements RouterAdapter {
  readonly current: SignalLike<RouteLocation>;
  private stack: RouteLocation[] = [];
  private guards: NavigationGuard[] = [];

  constructor(initial: Partial<RouteLocation> = {}) {
    this.current = signal({
      path: initial.path ?? "/",
      params: initial.params ?? {},
      query: initial.query ?? {},
      name: initial.name,
    });
  }

  private resolveTarget(to: RouteNavigateTarget): RouteLocation {
    if (typeof to === "string") return parsePath(to);
    const path = Object.entries(to.params ?? {}).reduce(
      (p, [k, v]) => p.replace(`:${k}`, v),
      to.name,
    );
    return { path, params: to.params ?? {}, query: to.query ?? {}, name: to.name };
  }

  async push(to: RouteNavigateTarget): Promise<void> {
    const next = this.resolveTarget(to);
    for (const guard of this.guards) {
      const allowed = await guard(next, this.current());
      if (!allowed) return;
    }
    this.stack.push(this.current());
    this.current(next);
  }

  replace(to: RouteNavigateTarget): void {
    this.current(this.resolveTarget(to));
  }

  back(): void {
    const prev = this.stack.pop();
    if (prev) this.current(prev);
  }

  beforeEach(handler: NavigationGuard): () => void {
    this.guards.push(handler);
    return () => {
      this.guards = this.guards.filter((g) => g !== handler);
    };
  }
}
