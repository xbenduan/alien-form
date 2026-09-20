import { computed, signal } from "alien-signals";
import type { ArrayFieldNode, FieldNode, RowNode } from "./types";
import type { SchemaNode } from "./schema-graph";

/** Canonical runtime state for one array field instance. */
export interface ArrayState {
  readonly rowIds: ReturnType<typeof signal<string[]>>;
  readonly indexById: ReturnType<typeof computed<Map<string, number>>>;
  readonly rows: Map<string, RowNode>;
}

type FieldRecord = {
  readonly field: FieldNode;
  readonly schema: SchemaNode;
  readonly children: Map<string, FieldNode>;
  validationGeneration: number;
  runtimeInstalled: boolean;
};

type RowRecord = {
  readonly row: RowNode;
  readonly fallbackIndex: number;
  readonly children: Map<string, FieldNode>;
};

/** Normalized owner of all live field, row and array instance state. */
export class InstanceStore {
  readonly fields = new Map<string, FieldNode>();
  private readonly fieldRecords = new WeakMap<FieldNode, FieldRecord>();
  private readonly instanceIds = new WeakMap<FieldNode, string>();
  private readonly rowRecords = new WeakMap<RowNode, RowRecord>();
  private readonly arrayStates = new WeakMap<ArrayFieldNode, ArrayState>();

  /** Registers a field by static schema identity plus enclosing row ancestry. */
  registerField(field: FieldNode, schema: SchemaNode, rowIds: readonly string[]): void {
    const instanceId = [schema.id, ...rowIds].join("@");
    this.fields.set(instanceId, field);
    this.instanceIds.set(field, instanceId);
    this.fieldRecords.set(field, {
      field,
      schema,
      children: new Map(),
      validationGeneration: 0,
      runtimeInstalled: false,
    });
  }

  /** Removes a field instance from the live store. */
  unregisterField(field: FieldNode): void {
    const instanceId = this.instanceIds.get(field);
    if (instanceId) this.fields.delete(instanceId);
    this.instanceIds.delete(field);
  }

  /** Returns the static descriptor for a live field instance. */
  schema(field: FieldNode): SchemaNode {
    return this.requireField(field).schema;
  }

  /** Returns the canonical child relation for a container field or row. */
  children(owner: FieldNode | RowNode): ReadonlyMap<string, FieldNode> {
    if ("kind" in owner) return this.requireField(owner).children;
    return this.requireRow(owner).children;
  }

  /** Connects a child instance to its canonical owner. */
  setChild(owner: FieldNode | RowNode, key: string, child: FieldNode): void {
    const children =
      "kind" in owner ? this.requireField(owner).children : this.requireRow(owner).children;
    children.set(key, child);
  }

  /** Clears canonical child relations during container disposal. */
  clearChildren(owner: FieldNode | RowNode): void {
    if ("kind" in owner) this.requireField(owner).children.clear();
    else this.requireRow(owner).children.clear();
  }

  /** Creates normalized array state with a computed O(1) row index table. */
  createArray(field: ArrayFieldNode): ArrayState {
    const rowIds = signal<string[]>([]);
    const state: ArrayState = {
      rowIds,
      indexById: computed(() => new Map(rowIds().map((rowId, index) => [rowId, index] as const))),
      rows: new Map(),
    };
    this.arrayStates.set(field, state);
    return state;
  }

  /** Returns normalized state for an array field. */
  array(field: ArrayFieldNode): ArrayState {
    const state = this.arrayStates.get(field);
    if (!state) throw new Error(`[alien-form] Missing array state for "${field.id}".`);
    return state;
  }

  /** Registers a stable row handle before its child fields are built. */
  registerRow(row: RowNode, fallbackIndex: number): void {
    const state = this.array(row.parent);
    state.rows.set(row.id, row);
    this.rowRecords.set(row, { row, fallbackIndex, children: new Map() });
  }

  /** Removes a row and its canonical child relation. */
  unregisterRow(row: RowNode): void {
    this.array(row.parent).rows.delete(row.id);
  }

  /** Returns the current row index in O(1) after the row-order signal is read. */
  rowIndex(row: RowNode): number {
    const record = this.requireRow(row);
    return this.array(row.parent).indexById().get(row.id) ?? record.fallbackIndex;
  }

  /** Returns row handles in current order. */
  rows(field: ArrayFieldNode): RowNode[] {
    const state = this.array(field);
    return state.rowIds().map((rowId) => state.rows.get(rowId) as RowNode);
  }

  /** Clears the live order of a disposed array field. */
  clearArray(field: ArrayFieldNode): void {
    this.array(field).rowIds([]);
  }

  /** Advances and returns the validation generation for latest-wins semantics. */
  bumpValidation(field: FieldNode): number {
    const record = this.requireField(field);
    record.validationGeneration += 1;
    return record.validationGeneration;
  }

  /** Returns the current validation generation. */
  validationGeneration(field: FieldNode): number {
    return this.requireField(field).validationGeneration;
  }

  /** Returns whether a field still belongs to this store. */
  has(field: FieldNode): boolean {
    return this.instanceIds.has(field);
  }

  /** Marks a field runtime as installed and reports whether installation is new. */
  installRuntime(field: FieldNode): boolean {
    const record = this.requireField(field);
    if (record.runtimeInstalled) return false;
    record.runtimeInstalled = true;
    return true;
  }

  /** Marks a field runtime as stopped. */
  stopRuntime(field: FieldNode): void {
    const record = this.fieldRecords.get(field);
    if (record) record.runtimeInstalled = false;
  }

  /** Returns the row ancestry used by stable descendant instance ids. */
  rowAncestry(field: FieldNode | undefined, row?: RowNode): string[] {
    const ids: string[] = [];
    const seen = new Set<RowNode>();
    let current = field;
    if (row) {
      seen.add(row);
      ids.unshift(row.id);
    }
    while (current) {
      if (current.row && !seen.has(current.row)) {
        seen.add(current.row);
        ids.unshift(current.row.id);
      }
      current = current.parent;
    }
    return ids;
  }

  /** Returns a field record or fails on an invalid internal handle. */
  private requireField(field: FieldNode): FieldRecord {
    const record = this.fieldRecords.get(field);
    if (!record) throw new Error(`[alien-form] Unknown field instance "${field.id}".`);
    return record;
  }

  /** Returns a row record or fails on an invalid internal handle. */
  private requireRow(row: RowNode): RowRecord {
    const record = this.rowRecords.get(row);
    if (!record) throw new Error(`[alien-form] Unknown row instance "${row.id}".`);
    return record;
  }
}
