export interface RouteLocation {
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  name?: string;
}

export type SignalLike<T> = {
  (): T;
  (value: T): void;
};

export type RouteNavigateTarget =
  | string
  | { name: string; params?: Record<string, string>; query?: Record<string, string> };

export type NavigationGuard = (
  to: RouteLocation,
  from: RouteLocation | undefined,
) => boolean | Promise<boolean>;

export interface RouterAdapter {
  readonly current: SignalLike<RouteLocation>;
  push(to: RouteNavigateTarget): void;
  replace(to: RouteNavigateTarget): void;
  back(): void;
  beforeEach?(handler: NavigationGuard): () => void;
}
