/**
 * @alien-form/core — Engine utilities (alien-signals dependent)
 */

import { getActiveSub, setActiveSub } from "alien-signals";

/** Shallow compare two arrays by reference equality of each element. */
export function arrayShallowEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Check whether a value is a thenable (Promise-like). */
export function isPromiseLike<T = any>(value: any): value is Promise<T> {
  return !!value && typeof value.then === "function";
}

/**
 * Execute a reader function without subscribing to any reactive dependencies.
 * Useful for snapshotting values without creating tracking links.
 *
 * NOTE: This uses alien-signals' low-level getActiveSub/setActiveSub because
 * the library does not expose an official `untracked()` API. If one is added
 * in the future, this helper should be replaced.
 */
export function readUntracked<T>(reader: () => T): T {
  const previous = getActiveSub();
  setActiveSub(undefined);
  try {
    return reader();
  } finally {
    setActiveSub(previous);
  }
}
