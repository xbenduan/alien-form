/**
 * @alien-form/core — Path utilities
 */
import type { IFieldSchema, NamePath } from "./types";

/** Converts public string or segment-array paths to the internal dotted path format. */
export function normalizeNamePath(path: NamePath): string {
  return typeof path === "string" ? path : path.map(String).join(".");
}

/** Reads a nested value from a dotted path. */
export function getDeepValue(obj: Record<string, any> | null | undefined, path: string): any {
  if (obj == null || !path) return undefined;
  const keys = path.split(".");
  let current: any = obj;
  for (const key of keys) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
}

/** Writes a nested value to a dotted path. */
export function setDeepValue(obj: Record<string, any>, path: string, value: any): void {
  if (!path) return;
  const keys = path.split(".");
  let current: any = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const nextKey = keys[i + 1];
    if (current[key] == null || typeof current[key] !== "object") {
      current[key] = /^\d+$/.test(nextKey) ? [] : {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

/** Sorts schema properties by their explicit order. */
export function sortByOrder(properties: Record<string, IFieldSchema>): [string, IFieldSchema][] {
  return Object.entries(properties).sort(
    ([, a], [, b]) => (a.order ?? Infinity) - (b.order ?? Infinity),
  );
}
