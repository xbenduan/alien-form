/**
 * @alien-form/core — $ref resolution (pure, stateless)
 */
import type { IFieldSchema } from "./types";

export interface ResolveRefResult {
  schema: IFieldSchema;
  fromRef: boolean;
  /**
   * Definition names consumed while flattening the $ref chain for this node
   * (e.g. resolving `#/definitions/A` where A -> B yields {"A", "B"}). The tree
   * walk threads these into its `seen` set so that recursive definitions
   * (a definition reaching itself through `properties`/`items`) are detected as
   * cycles instead of recursing forever.
   */
  consumed: Set<string>;
}

export function resolveSchemaRef(
  schema: IFieldSchema,
  definitions: Record<string, IFieldSchema>,
  onError?: (ref: string, message: string) => void,
  seen: Set<string> = new Set(),
): ResolveRefResult {
  if (!schema.$ref) return { schema, fromRef: false, consumed: new Set() };
  const refPath = schema.$ref.replace(/^#\/definitions\//, "");
  if (seen.has(refPath)) {
    onError?.(schema.$ref, `Circular $ref: ${schema.$ref}`);
    const { $ref: _, ...rest } = schema;
    return { schema: rest as IFieldSchema, fromRef: false, consumed: new Set() };
  }
  const resolved = definitions[refPath];
  if (!resolved) {
    onError?.(schema.$ref, `Unresolved $ref: ${schema.$ref}`);
    return { schema, fromRef: false, consumed: new Set() };
  }
  const nextSeen = new Set(seen);
  nextSeen.add(refPath);
  const nested = resolveSchemaRef(resolved, definitions, onError, nextSeen);
  const { $ref: _, ...localProps } = schema;
  const consumed = new Set(nested.consumed);
  consumed.add(refPath);
  return { schema: { ...nested.schema, ...localProps }, fromRef: true, consumed };
}

/** Recursively resolve all $refs in a schema tree */
export function resolveSchemaTree(
  schema: IFieldSchema,
  definitions: Record<string, IFieldSchema>,
  onError?: (ref: string, message: string) => void,
  seen: Set<string> = new Set(),
): IFieldSchema {
  const { schema: resolved, consumed } = resolveSchemaRef(schema, definitions, onError, seen);
  // Carry the definition names consumed at this node down into the child walk so a
  // definition that references itself through properties/items is caught as a cycle.
  const childSeen = consumed.size > 0 ? new Set([...seen, ...consumed]) : seen;
  let result = resolved;
  if (resolved.properties) {
    result = { ...result, properties: Object.fromEntries(
      Object.entries(resolved.properties).map(([k, v]) => [k, resolveSchemaTree(v, definitions, onError, childSeen)])
    )};
  }
  if (resolved.items && !Array.isArray(resolved.items)) {
    result = { ...result, items: resolveSchemaTree(resolved.items as IFieldSchema, definitions, onError, childSeen) };
  }
  return result;
}
