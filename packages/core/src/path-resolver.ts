import type { ArrayFieldNode, FieldNode, ObjectFieldNode, RowNode } from "./types";
import { InstanceStore } from "./instance-store";

/** Resolves dynamic data paths from static schema identity and live row order. */
export class PathResolver {
  constructor(private readonly store: InstanceStore) {}

  /** Derives the current public path of a stable field handle. */
  fieldPath(field: FieldNode): string {
    const schema = this.store.schema(field);
    if (!schema.key) return "";
    if (field.row && field.parent === field.row.parent) {
      return this.join(this.rowPath(field.row), schema.key);
    }
    const container = field.parent ? this.dataContainerPath(field.parent) : "";
    return this.join(container, schema.key);
  }

  /** Derives the current public path of a stable row handle. */
  rowPath(row: RowNode): string {
    return this.join(this.fieldPath(row.parent), String(this.store.rowIndex(row)));
  }

  /** Resolves a public data path against current row order. */
  field(root: ObjectFieldNode, path: string): FieldNode | undefined {
    if (!path) return root;
    return this.children(this.store.children(root), path.split("."));
  }

  /** Resolves a data path relative to one row. */
  rowChild(row: RowNode, path: string): FieldNode | undefined {
    return this.children(this.store.children(row), path.split("."));
  }

  /** Resolves a relative selector against a field's current path. */
  relative(field: FieldNode, selector: string): string {
    if (!selector.startsWith("./")) return selector;
    const path = this.fieldPath(field);
    const base = path.includes(".") ? path.slice(0, path.lastIndexOf(".")) : "";
    return base ? `${base}.${selector.slice(2)}` : selector.slice(2);
  }

  /** Returns the data-container path used by flattened void children. */
  private dataContainerPath(field: FieldNode): string {
    if (field.kind !== "void") return this.fieldPath(field);
    if (field.row && field.parent === field.row.parent) return this.rowPath(field.row);
    return field.parent ? this.dataContainerPath(field.parent) : "";
  }

  /** Resolves child segments while treating void nodes as transparent containers. */
  private children(
    children: ReadonlyMap<string, FieldNode>,
    segments: string[],
  ): FieldNode | undefined {
    if (segments.length === 0) return undefined;
    const [segment, ...rest] = segments;
    const direct = children.get(segment);
    if (direct) return rest.length === 0 ? direct : this.node(direct, rest);
    for (const child of children.values()) {
      if (child.kind !== "void") continue;
      const nested = this.children(this.store.children(child), segments);
      if (nested) return nested;
    }
    return undefined;
  }

  /** Resolves segments below a concrete field instance. */
  private node(node: FieldNode, segments: string[]): FieldNode | undefined {
    if (segments.length === 0) return node;
    const [segment, ...rest] = segments;
    if (node.kind === "object") return this.children(this.store.children(node), segments);
    if (node.kind === "array" && /^\d+$/.test(segment)) {
      const row = this.store.rows(node as ArrayFieldNode)[Number(segment)];
      if (!row || rest.length === 0) return undefined;
      return this.children(this.store.children(row), rest);
    }
    return undefined;
  }

  /** Joins non-empty dotted path segments. */
  private join(parent: string, child: string): string {
    return parent ? `${parent}.${child}` : child;
  }
}
