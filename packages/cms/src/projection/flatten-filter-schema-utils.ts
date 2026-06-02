import type { CmsFieldSchema } from "../types/schema";

function cloneUnknown<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneUnknown(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [key, cloneUnknown(nestedValue)]),
    ) as T;
  }
  return value;
}

function resolveSelector(
  selector: string,
  parentPath: string[],
  siblingKeys: Set<string>,
) {
  if (!selector || selector.startsWith("$")) {
    return selector;
  }

  if (selector.includes(".")) {
    return selector;
  }

  if (parentPath.length > 0 && siblingKeys.has(selector)) {
    return [...parentPath, selector].join(".");
  }

  return selector;
}

function rewriteDependencies(
  dependencies: unknown,
  parentPath: string[],
  siblingKeys: Set<string>,
) {
  if (typeof dependencies === "string") {
    return resolveSelector(dependencies, parentPath, siblingKeys);
  }

  if (Array.isArray(dependencies)) {
    return dependencies.map((item) => (
      typeof item === "string"
        ? resolveSelector(item, parentPath, siblingKeys)
        : cloneUnknown(item)
    ));
  }

  if (dependencies && typeof dependencies === "object") {
    return Object.fromEntries(
      Object.entries(dependencies as Record<string, unknown>).map(([key, value]) => [
        key,
        typeof value === "string"
          ? resolveSelector(value, parentPath, siblingKeys)
          : cloneUnknown(value),
      ]),
    );
  }

  return dependencies;
}

function rewriteReactionConfigValue(
  key: string,
  value: unknown,
  parentPath: string[],
  siblingKeys: Set<string>,
): unknown {
  if (key === "selector" && typeof value === "string") {
    return resolveSelector(value, parentPath, siblingKeys);
  }

  if (key === "dependencies") {
    return rewriteDependencies(value, parentPath, siblingKeys);
  }

  if (key === "filters" && Array.isArray(value)) {
    return value.map((item) => {
      if (!item || typeof item !== "object") {
        return cloneUnknown(item);
      }
      const record = item as Record<string, unknown>;
      return {
        ...cloneUnknown(record),
        selector: typeof record.selector === "string"
          ? resolveSelector(record.selector, parentPath, siblingKeys)
          : cloneUnknown(record.selector),
      };
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (!item || typeof item !== "object") {
        return cloneUnknown(item);
      }
      return rewriteReactionObject(item as Record<string, unknown>, parentPath, siblingKeys);
    });
  }

  if (value && typeof value === "object") {
    return rewriteReactionObject(value as Record<string, unknown>, parentPath, siblingKeys);
  }

  return cloneUnknown(value);
}

function rewriteReactionObject(
  input: Record<string, unknown>,
  parentPath: string[],
  siblingKeys: Set<string>,
) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      rewriteReactionConfigValue(key, value, parentPath, siblingKeys),
    ]),
  );
}

export function cloneFilterFieldSchema(
  field: CmsFieldSchema,
  parentPath: string[],
  siblingKeys: Iterable<string>,
) {
  const siblingKeySet = new Set(siblingKeys);
  const nextField = cloneUnknown(field);

  if (nextField["x-reaction"]) {
    nextField["x-reaction"] = rewriteReactionObject(
      nextField["x-reaction"] as Record<string, unknown>,
      parentPath,
      siblingKeySet,
    ) as CmsFieldSchema["x-reaction"];
  }

  if (nextField["x-cms"]?.reactions) {
    nextField["x-cms"] = {
      ...nextField["x-cms"],
      reactions: Object.fromEntries(
        Object.entries(nextField["x-cms"].reactions).map(([key, value]) => [
          key,
          rewriteReactionObject(value, parentPath, siblingKeySet),
        ]),
      ),
    };
  }

  return nextField;
}
