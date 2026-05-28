/**
 * @alien-form/core — Pure $ref resolution
 *
 * Stateless helper that resolves `$ref: "#/definitions/Name"` references
 * against a definitions dictionary. Reports errors through a callback
 * so callers can wire them into their own error channels (console, form, etc.).
 */

import type { IFieldSchema } from "./types";

export interface ResolveRefResult {
  /** The resolved schema with local overrides merged in. */
  schema: IFieldSchema;
  /** Whether the result came from a $ref resolution (used by rendering layer). */
  fromRef: boolean;
}

/**
 * Resolve `$ref` for a single IFieldSchema node against the given definitions.
 *
 * Follows transitive refs (a definition that itself contains $ref) and detects
 * cycles. Properties and items are *not* recursively resolved — callers should
 * handle tree-walking after the top-level ref is resolved.
 */
export function resolveSchemaRef(
  schema: IFieldSchema,
  definitions: Record<string, IFieldSchema>,
  onError?: (ref: string, message: string) => void,
  seen: Set<string> = new Set(),
): ResolveRefResult {
  if (!schema.$ref) return { schema, fromRef: false };

  const refPath = schema.$ref.replace(/^#\/definitions\//, "");

  if (seen.has(refPath)) {
    const chain = Array.from(seen).concat(refPath).join(" -> ");
    onError?.(schema.$ref, `Circular $ref detected: ${schema.$ref} (chain: ${chain})`);
    const { $ref: _, ...localProps } = schema;
    void _;
    return { schema: localProps as IFieldSchema, fromRef: false };
  }

  const resolved = definitions[refPath];
  if (!resolved) {
    onError?.(schema.$ref, `Could not resolve $ref: ${schema.$ref}`);
    return { schema, fromRef: false };
  }

  const nextSeen = new Set(seen);
  nextSeen.add(refPath);

  const nested = resolveSchemaRef(resolved, definitions, onError, nextSeen);

  const { $ref: _, ...localProps } = schema;
  void _;
  return {
    schema: { ...nested.schema, ...localProps },
    fromRef: true,
  };
}