/**
 * @alien-form/core — $ref resolution (pure, stateless)
 */
import type { IFieldSchema } from "./types";

export interface ResolveRefResult {
  schema: IFieldSchema;
  fromRef: boolean;
}

export function resolveSchemaRef(
  schema: IFieldSchema,
  definitions: Record<string, IFieldSchema>,
  onError?: (ref: string, message: string) => void,
  seen: Set<string> = new Set(),
): ResolveRefResult {
  if (!schema.$ref) return { schema, fromRef: false };
  const refPath = schema.$ref.replace(/^#\/definitions\//, "");
  if (seen.has(refPath)) {
    onError?.(schema.$ref, `Circular $ref: ${schema.$ref}`);
    const { $ref: _, ...rest } = schema;
    return { schema: rest as IFieldSchema, fromRef: false };
  }
  const resolved = definitions[refPath];
  if (!resolved) {
    onError?.(schema.$ref, `Unresolved $ref: ${schema.$ref}`);
    return { schema, fromRef: false };
  }
  const nextSeen = new Set(seen);
  nextSeen.add(refPath);
  const nested = resolveSchemaRef(resolved, definitions, onError, nextSeen);
  const { $ref: _, ...localProps } = schema;
  return { schema: { ...nested.schema, ...localProps }, fromRef: true };
}

/** Recursively resolve all $refs in a schema tree */
export function resolveSchemaTree(
  schema: IFieldSchema,
  definitions: Record<string, IFieldSchema>,
  onError?: (ref: string, message: string) => void,
  seen: Set<string> = new Set(),
): IFieldSchema {
  const { schema: resolved } = resolveSchemaRef(schema, definitions, onError, seen);
  let result = resolved;
  if (resolved.properties) {
    result = { ...result, properties: Object.fromEntries(
      Object.entries(resolved.properties).map(([k, v]) => [k, resolveSchemaTree(v, definitions, onError, new Set(seen))])
    )};
  }
  if (resolved.items && !Array.isArray(resolved.items)) {
    result = { ...result, items: resolveSchemaTree(resolved.items as IFieldSchema, definitions, onError, new Set(seen)) };
  }
  return result;
}
