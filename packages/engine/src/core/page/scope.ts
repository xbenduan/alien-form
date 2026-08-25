import type { BlockRuntime } from "./block";

export interface PageScope {
  block: (name: string) => BlockRuntime;
  service: (code: string, params?: unknown) => Promise<unknown>;
  fn: (code: string, ...args: unknown[]) => unknown;
  constant: (key: string) => unknown;
  params: Record<string, string>;
  query: Record<string, string>;
}
