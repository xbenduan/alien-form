import {
  batch,
  createRoot,
  createSignal,
  getOwner,
  onCleanup,
  runWithOwner,
  untrack,
} from "solid-js";
import type { Accessor, Owner, Setter } from "solid-js";
import { FormworkError } from "../model/errors";
import { cloneJson, escapePointer, isObject, pointerSegments } from "../model/pointer";
import { applyDefaults, resolveSchema, schemaType, validateValue } from "../model/validation";
import type { DataSchema, JsonValue, ValidationIssue } from "../model/types";
import type { ArrayHandle, ScopeOptions, ValueScope } from "./types";

type AnchoredIssue = { cell: Cell; suffix: string; code: string; message: string };
let sequence = 0;
const internals = new WeakMap<ValueScope, Cell>();
const fail = (code: string, path: string, message: string): never => {
  throw new FormworkError(code, message, [{ code, path, message }]);
};

class Cell {
  readonly schema: DataSchema;
  readonly key = `item-${++sequence}`;
  readonly present: Accessor<boolean>;
  readonly setPresent: Setter<boolean>;
  readonly scalar: Accessor<JsonValue | undefined>;
  readonly setScalar: Setter<JsonValue | undefined>;
  readonly entries: Accessor<readonly Cell[]>;
  readonly setEntries: Setter<readonly Cell[]>;
  readonly segment: Accessor<string>;
  readonly setSegment: Setter<string>;
  readonly problems: Accessor<readonly AnchoredIssue[]>;
  readonly setProblems: Setter<readonly AnchoredIssue[]>;
  readonly children = new Map<string, Cell>();
  readonly scope: ValueScope;
  readonly item: { key: string; scope: ValueScope };
  readonly readOnly: boolean;
  alive = true;
  version = 0;
  round = 0;
  task?: AbortController;
  handle?: ArrayHandle;
  disposeOwner: () => void = () => {};
  private initial: JsonValue | undefined;

  constructor(
    schema: DataSchema,
    readonly referenceRoot: DataSchema,
    value: JsonValue | undefined,
    readonly owner: Owner,
    readonly parent?: Cell,
    segment = "",
    readOnly = false,
    private validator?: ScopeOptions["validate"],
  ) {
    this.schema = resolveSchema(schema, referenceRoot);
    this.readOnly = readOnly || !!this.schema.readOnly || !!parent?.readOnly;
    [this.present, this.setPresent] = createSignal(value !== undefined);
    [this.scalar, this.setScalar] = createSignal<JsonValue | undefined>();
    [this.entries, this.setEntries] = createSignal<readonly Cell[]>([]);
    [this.segment, this.setSegment] = createSignal(segment);
    [this.problems, this.setProblems] = createSignal<readonly AnchoredIssue[]>([]);
    this.initial = cloneJson(value);
    this.scope = {
      value: () => cloneJson(this.snapshot()),
      errors: () => this.errors(),
      set: (pointer, next) =>
        batch(() => {
          this.assertWritable();
          const target = this.at(pointer);
          target.assertWritable();
          if (next === undefined && target.parent && schemaType(target.parent.schema) === "array")
            fail("INVALID_VALUE", pointer, "数组项不能删除值，请使用 remove");
          if (next !== undefined) target.materializeParents();
          target.replace(cloneJson(next));
          target.changed();
        }),
      reset: (...args: [JsonValue?]) =>
        batch(() => {
          this.assertAlive();
          this.replace(cloneJson(args.length ? args[0] : this.initial));
          this.changed();
        }),
      validate: () => this.validate(),
      array: (pointer) => this.at(pointer).array(),
    };
    this.item = { key: this.key, scope: this.scope };
    internals.set(this.scope, this);
    runWithOwner(owner, () =>
      createRoot((dispose) => {
        this.disposeOwner = dispose;
        this.replace(value);
        onCleanup(() => this.stop());
      }),
    );
  }

  path(): string {
    return this.parent ? `${this.parent.path()}/${escapePointer(this.segment())}` : "";
  }
  assertAlive() {
    if (!this.alive) fail("ABORTED", this.path(), "scope 已销毁");
  }
  assertWritable() {
    this.assertAlive();
    if (this.readOnly) fail("READ_ONLY", this.path(), "字段只读");
  }
  stop() {
    if (!this.alive) return;
    this.alive = false;
    this.task?.abort();
    for (const child of [...this.children.values(), ...untrack(this.entries)]) {
      try {
        child.dispose();
      } catch (error) {
        console.error("Formwork scope cleanup:", error);
      }
    }
  }
  dispose() {
    this.stop();
    this.disposeOwner();
  }
  changed(clear = true) {
    // 遍历树的可变游标从当前节点开始。
    // oxlint-disable-next-line typescript/no-this-alias
    for (let cell: Cell | undefined = this; cell; cell = cell.parent) {
      cell.version++;
      cell.task?.abort();
      if (clear) cell.setProblems([]);
    }
  }
  replace(value: JsonValue | undefined) {
    this.task?.abort();
    this.version++;
    this.setProblems([]);
    this.setPresent(value !== undefined);
    const type = schemaType(this.schema);
    if (type === "object" && "properties" in this.schema) {
      for (const [name, schema] of Object.entries(this.schema.properties)) {
        const next =
          isObject(value) && Object.hasOwn(value, name) ? (value[name] as JsonValue) : undefined;
        const existing = this.children.get(name);
        if (existing) existing.replace(next);
        else
          this.children.set(
            name,
            new Cell(schema, this.referenceRoot, next, this.owner, this, name),
          );
      }
      // 保留非法但可校验的载入值，不悄悄截断未知字段。
      this.setScalar(() => cloneJson(value));
    } else if (type === "array" && "items" in this.schema) {
      for (const item of untrack(this.entries)) item.dispose();
      const items = Array.isArray(value)
        ? value.map(
            (item, index) =>
              new Cell(
                (this.schema as DataSchema & { items: DataSchema }).items,
                this.referenceRoot,
                item,
                this.owner,
                this,
                String(index),
              ),
          )
        : [];
      this.setEntries(items);
      this.setScalar(() => cloneJson(value));
    } else this.setScalar(() => cloneJson(value));
  }
  snapshot(): JsonValue | undefined {
    if (!this.present()) return undefined;
    const original = this.scalar();
    if ("properties" in this.schema) {
      if (!isObject(original)) return original;
      const value: Record<string, JsonValue> = {};
      for (const [name, old] of Object.entries(original))
        if (!this.children.has(name))
          Object.defineProperty(value, name, {
            value: cloneJson(old as JsonValue),
            enumerable: true,
          });
      for (const [name, child] of this.children) {
        const next = child.snapshot();
        if (next !== undefined)
          Object.defineProperty(value, name, {
            value: next,
            enumerable: true,
            configurable: true,
            writable: true,
          });
      }
      return value;
    }
    if ("items" in this.schema)
      return Array.isArray(original) ? this.entries().map((cell) => cell.snapshot()!) : original;
    return original;
  }
  at(pointer: string): Cell {
    // oxlint-disable-next-line typescript/no-this-alias
    let cell: Cell = this;
    for (const part of pointerSegments(pointer)) {
      if ("properties" in cell.schema && cell.children.has(part)) cell = cell.children.get(part)!;
      else if (
        "items" in cell.schema &&
        /^(0|[1-9]\d*)$/u.test(part) &&
        Number(part) < cell.entries().length
      )
        cell = cell.entries()[Number(part)]!;
      else return fail("UNKNOWN_FIELD", pointer, "字段不存在或数组越界");
    }
    return cell;
  }
  private anchor(issue: ValidationIssue): AnchoredIssue {
    // oxlint-disable-next-line typescript/no-this-alias
    let cell: Cell = this;
    const parts = pointerSegments(issue.path);
    let index = 0;
    for (; index < parts.length; index++) {
      const next =
        cell.children.get(parts[index]!) ??
        ("items" in cell.schema ? untrack(cell.entries)[Number(parts[index])] : undefined);
      if (!next) break;
      cell = next;
    }
    return {
      cell,
      suffix: parts
        .slice(index)
        .map((part) => `/${escapePointer(part)}`)
        .join(""),
      code: issue.code,
      message: issue.message,
    };
  }
  errors(): ValidationIssue[] {
    const prefix = this.path();
    const all: AnchoredIssue[] = [];
    const collect = (cell: Cell) => {
      all.push(...cell.problems());
      for (const child of cell.children.values()) collect(child);
      for (const child of cell.entries()) collect(child);
    };
    collect(this);
    for (let parent = this.parent; parent; parent = parent.parent) all.push(...parent.problems());
    const unique = new Map<string, ValidationIssue>();
    for (const issue of all) {
      if (!issue.cell.alive) continue;
      const path = issue.cell.path() + issue.suffix;
      if (path !== prefix && !path.startsWith(prefix + "/")) continue;
      const relative = {
        path: path.slice(prefix.length),
        code: issue.code,
        message: issue.message,
      };
      unique.set(JSON.stringify(relative), relative);
    }
    return [...unique.values()];
  }
  private async validate() {
    this.assertAlive();
    this.task?.abort();
    const task = (this.task = new AbortController());
    const version = this.version;
    const round = ++this.round;
    const current = () =>
      this.alive && !task.signal.aborted && version === this.version && round === this.round;
    const value = untrack(() => this.scope.value());
    let issues = validateValue(this.schema, value, this.referenceRoot);
    try {
      if (!issues.length && this.validator)
        issues = [...(await this.validator(value, { signal: task.signal }))];
    } catch (error) {
      if (!current()) return { status: "stale" as const, issues: [] };
      issues = [
        {
          path: "",
          code: "VALIDATOR_FAILED",
          message: error instanceof Error ? error.message : String(error),
        },
      ];
    }
    if (!current()) return { status: "stale" as const, issues: [] };
    this.setProblems(issues.map((issue) => this.anchor(issue)));
    return { status: issues.length ? ("invalid" as const) : ("valid" as const), issues };
  }
  private ensureArray() {
    this.assertWritable();
    if (!this.present()) {
      this.setPresent(true);
      this.setScalar([]);
      this.materializeParents();
    }
    if (!Array.isArray(untrack(this.scalar))) fail("INVALID_VALUE", this.path(), "当前值不是数组");
  }
  materializeParents() {
    for (let cell = this.parent; cell; cell = cell.parent) {
      if (!untrack(cell.present)) {
        cell.setPresent(true);
        cell.setScalar({});
      }
      if ("properties" in cell.schema && !isObject(untrack(cell.scalar)))
        fail("INVALID_VALUE", cell.path(), "父字段不是 object");
    }
  }
  array(): ArrayHandle {
    if (!("items" in this.schema))
      return fail("INVALID_OPERATION", this.path(), "该字段不是 array");
    if (this.handle) return this.handle;
    const itemSchema = this.schema.items;
    const reorder = (items: Cell[]) => {
      items.forEach((cell, index) => cell.setSegment(String(index)));
      this.setEntries(items);
    };
    const indexCheck = (index: number, maximum: number) => {
      if (!Number.isInteger(index) || index < 0 || index > maximum)
        fail("INVALID_INDEX", this.path(), "数组索引越界");
    };
    return (this.handle = {
      items: () => this.entries().map((cell) => cell.item),
      insert: (index, value) =>
        batch(() => {
          this.ensureArray();
          const items = [...untrack(this.entries)];
          indexCheck(index, items.length);
          let next = applyDefaults(itemSchema, value, this.referenceRoot);
          const type = schemaType(resolveSchema(itemSchema, this.referenceRoot));
          if (next === undefined && type === "object") next = {};
          if (next === undefined && type === "array") next = [];
          if (next === undefined)
            return fail("VALUE_REQUIRED", this.path(), "标量数组项需要明确的值");
          const cell = new Cell(
            itemSchema,
            this.referenceRoot,
            next,
            this.owner,
            this,
            String(index),
          );
          items.splice(index, 0, cell);
          reorder(items);
          this.changed(false);
          return cell.key;
        }),
      remove: (key) =>
        batch(() => {
          this.assertWritable();
          const items = [...untrack(this.entries)];
          const index = items.findIndex((cell) => cell.key === key);
          if (index < 0) return fail("NOT_FOUND", this.path(), "数组项不存在");
          items[index]!.dispose();
          items.splice(index, 1);
          reorder(items);
          this.changed(false);
        }),
      move: (key, index) =>
        batch(() => {
          this.assertWritable();
          const items = [...untrack(this.entries)];
          indexCheck(index, items.length - 1);
          const from = items.findIndex((cell) => cell.key === key);
          if (from < 0) return fail("NOT_FOUND", this.path(), "数组项不存在");
          const [cell] = items.splice(from, 1);
          items.splice(index, 0, cell!);
          reorder(items);
          this.changed(false);
        }),
    });
  }
}

// 仅内部渲染和表达式访问身份，不暴露额外字段或资源 API。
export function scopeCell(scope: ValueScope): Cell {
  const cell = internals.get(scope);
  if (!cell) throw new FormworkError("INVALID_SCOPE", "scope 必须由当前 Formwork 创建");
  return cell;
}

export function createValueScope(
  options: ScopeOptions,
  defaultSchema: DataSchema,
  referenceRoot = defaultSchema,
): ValueScope {
  const owner = getOwner();
  if (!owner) throw new FormworkError("INVALID_OWNER", "createScope 必须在 Solid owner 下调用");
  const schema = options.schema ?? defaultSchema;
  let value =
    options.defaults === false
      ? cloneJson(options.value)
      : applyDefaults(schema, options.value, referenceRoot);
  const type = schemaType(resolveSchema(schema, referenceRoot));
  if (value === undefined && type === "object") value = {};
  if (value === undefined && type === "array") value = [];
  const cell = new Cell(
    schema,
    referenceRoot,
    value,
    owner,
    undefined,
    "",
    options.readOnly,
    options.validate,
  );
  onCleanup(() => cell.dispose());
  return cell.scope;
}
