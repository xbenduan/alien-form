/**
 * @alien-form/core — Path utilities
 *
 * The flat field model uses `.` as the path separator and numeric segments to
 * denote array indices. These helpers operate on that convention.
 */

import type { IFieldSchema, IFormSchema } from "./types";

export function getDeepValue(obj: Record<string, any> | null | undefined, path: string): any {
  if (obj === undefined || obj === null) return undefined;
  if (!path) return obj;

  const keys = path.split(".").filter(Boolean);
  let current: any = obj;
  for (const key of keys) {
    if (current === undefined || current === null) return undefined;
    current = current[key];
  }
  return current;
}

export function setDeepValue(obj: Record<string, any>, path: string, value: any): void {
  if (!path) return;

  const keys = path.split(".").filter(Boolean);
  if (keys.length === 0) return;

  let current: any = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const nextKey = keys[i + 1];
    const currentValue = current[key];
    if (currentValue === undefined || currentValue === null || typeof currentValue !== "object") {
      current[key] = /^\d+$/.test(nextKey) ? [] : {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

/** Sort schema properties by `order` (ascending; missing means last). */
export function sortByOrder(
  properties: Record<string, IFieldSchema>,
): Record<string, IFieldSchema> {
  const entries = Object.entries(properties);
  entries.sort(([, a], [, b]) => {
    const ai = a.order ?? Infinity;
    const bi = b.order ?? Infinity;
    return ai - bi;
  });
  return Object.fromEntries(entries);
}

/**
 * Walk the schema tree along a dotted path and return whether the leaf node
 * is declared as `type: 'void'` (used as a layout container).
 */
export function isVoidField(path: string, schema: IFormSchema | null): boolean {
  if (!schema?.properties) return false;
  const parts = path.split(".");
  let current: Record<string, IFieldSchema> | undefined = schema.properties;
  for (let i = 0; i < parts.length; i++) {
    if (!current) return false;
    const fs: IFieldSchema | undefined = current[parts[i]];
    if (!fs) return false;
    if (i === parts.length - 1) {
      return fs.type === "void";
    }
    current = fs.properties;
  }
  return false;
}
