import type { FieldKind, IFieldSchema, IFormSchema } from "./types";
import { sortByOrder } from "./path";
import { resolveSchemaRef } from "./ref-resolve";

/** A static schema descriptor shared by every runtime instance of that schema node. */
export interface SchemaNode {
  readonly id: string;
  readonly key: string;
  readonly kind: FieldKind;
  readonly schema: IFieldSchema;
  readonly required: boolean;
  readonly children: ReadonlyMap<string, SchemaNode>;
  readonly item?: SchemaNode;
}

/** The immutable schema graph compiled once when a form is created. */
export interface SchemaGraph {
  readonly root: SchemaNode;
  readonly nodes: ReadonlyMap<string, SchemaNode>;
}

type CompileContext = {
  readonly definitions: Record<string, IFieldSchema>;
  readonly nodes: Map<string, SchemaNode>;
  readonly onError?: (path: string, ref: string, message: string) => void;
};

/** Returns the runtime capability represented by a schema node. */
function schemaKind(schema: IFieldSchema): FieldKind {
  if (schema.type === "void" || schema["x-layout"]) return "void";
  if (schema.type === "array" && schema.items && !Array.isArray(schema.items)) return "array";
  if (schema.type === "object") return "object";
  return "primitive";
}

/** Compiles one schema node and all descendants into stable descriptors. */
function compileNode(
  ctx: CompileContext,
  raw: IFieldSchema,
  id: string,
  key: string,
  parentRequired: boolean | string[] | undefined,
  seen: Set<string>,
): SchemaNode {
  const { schema: resolved, consumed } = resolveSchemaRef(
    raw,
    ctx.definitions,
    (ref, message) => ctx.onError?.(id, ref, message),
    seen,
  );
  const childSeen = consumed.size > 0 ? new Set([...seen, ...consumed]) : seen;
  const childEntries = resolved.properties
    ? sortByOrder(resolved.properties).map(
        ([childKey, child]) =>
          [
            childKey,
            compileNode(ctx, child, `${id}.${childKey}`, childKey, resolved.required, childSeen),
          ] as const,
      )
    : [];
  const children = new Map(childEntries);
  const item =
    resolved.items && !Array.isArray(resolved.items)
      ? compileNode(ctx, resolved.items, `${id}[]`, "[]", undefined, childSeen)
      : undefined;
  const schema: IFieldSchema = {
    ...resolved,
    ...(resolved.properties
      ? {
          properties: Object.fromEntries(
            childEntries.map(([childKey, child]) => [childKey, child.schema]),
          ),
        }
      : {}),
    ...(item ? { items: item.schema } : {}),
  };
  const node: SchemaNode = {
    id,
    key,
    kind: schemaKind(schema),
    schema,
    required:
      schema.required === true || (Array.isArray(parentRequired) && parentRequired.includes(key)),
    children,
    item,
  };
  ctx.nodes.set(id, node);
  return node;
}

/** Resolves references and compiles a form schema exactly once. */
export function compileSchemaGraph(
  schema: IFormSchema,
  definitions: Record<string, IFieldSchema>,
  onError?: (path: string, ref: string, message: string) => void,
): SchemaGraph {
  const nodes = new Map<string, SchemaNode>();
  const root = compileNode(
    { definitions, nodes, onError },
    { ...schema, type: "object" },
    "$root",
    "",
    schema.required,
    new Set(),
  );
  return { root, nodes };
}
