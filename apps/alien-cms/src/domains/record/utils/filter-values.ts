/** 把扁平 filter 值（key 形如 `$root.a.b` 或顶层 `x`）还原为嵌套对象。*/
export function restoreFilterValues(flat: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [flatKey, value] of Object.entries(flat)) {
    if (value === undefined || value === null || value === "") continue;
    const path = flatKey.startsWith("$root.") ? flatKey.slice("$root.".length) : flatKey;
    const keys = path.split(".");
    let cursor = result;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (typeof cursor[k] !== "object" || cursor[k] === null) cursor[k] = {};
      cursor = cursor[k] as Record<string, unknown>;
    }
    cursor[keys[keys.length - 1]] = value;
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** 把嵌套 filter 值扁平化为 `$root.a.b` 形式（顶层 key 保持原样）。*/
export function flattenFilterValues(nested: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const walk = (value: unknown, segments: string[]) => {
    if (isPlainObject(value)) {
      for (const [childKey, childValue] of Object.entries(value)) {
        walk(childValue, [...segments, childKey]);
      }
      return;
    }

    const path = segments.join(".");
    const flatKey = segments.length > 1 ? `$root.${path}` : path;
    result[flatKey] = value;
  };

  for (const [key, value] of Object.entries(nested)) {
    walk(value, [key]);
  }

  return result;
}
