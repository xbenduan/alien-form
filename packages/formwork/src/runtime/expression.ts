import { createComputed, createSignal, onCleanup, untrack } from "solid-js";
import { compileExpression, expressionBody } from "../model/expression";
import { FormworkError } from "../model/errors";
import { cloneJson, escapePointer } from "../model/pointer";
import type { JsonValue, ValidationIssue } from "../model/types";
import { scopeCell } from "./scope";
import type { ActionContext, ValueScope } from "./types";

type Cell = ReturnType<typeof scopeCell>;
type Writer = { target: Cell; dependencies: Set<Cell> };
const graphs = new WeakMap<Cell, Map<Cell, Writer>>();
const environmentPrograms = new Map<string, (environment: unknown) => unknown>();
const ancestors = (a: Cell, b: Cell) => {
  for (let cell: Cell | undefined = b; cell; cell = cell.parent) if (cell === a) return true;
  return false;
};
function graphFor(cell: Cell) {
  while (cell.parent) cell = cell.parent;
  let graph = graphs.get(cell);
  if (!graph) graphs.set(cell, (graph = new Map()));
  return graph;
}
function checkGraph(graph: Map<Cell, Writer>) {
  const active = new Set<Cell>();
  const done = new Set<Cell>();
  const visit = (cell: Cell) => {
    if (active.has(cell))
      throw new FormworkError("EXPRESSION_CYCLE", `表达式写入环 ${cell.path()}`);
    if (done.has(cell)) return;
    active.add(cell);
    for (const dependency of graph.get(cell)?.dependencies ?? [])
      for (const other of graph.keys())
        if (ancestors(dependency, other) || ancestors(other, dependency)) visit(other);
    active.delete(cell);
    done.add(cell);
  };
  for (const cell of graph.keys()) visit(cell);
}

function valuesProxy(root: Cell, observe: (cell: Cell) => void): unknown {
  const read = (cell: Cell): unknown => {
    if (!("properties" in cell.schema)) observe(cell);
    if (!cell.present()) return undefined;
    if ("properties" in cell.schema) return object(cell);
    if ("items" in cell.schema) return array(cell);
    return cell.scalar();
  };
  const object = (cell: Cell): unknown =>
    new Proxy(
      {},
      {
        get(_target, key) {
          if (key === "toJSON")
            return () => {
              observe(cell);
              return cell.snapshot();
            };
          if (typeof key === "symbol") return undefined;
          const child = cell.children.get(key);
          if (!child)
            throw new FormworkError(
              "UNKNOWN_FIELD",
              `表达式字段不存在 ${cell.path()}/${escapePointer(key)}`,
            );
          return read(child);
        },
        ownKeys: () => {
          observe(cell);
          return [...cell.children].filter(([, child]) => child.present()).map(([name]) => name);
        },
        getOwnPropertyDescriptor: (_target, key) =>
          typeof key === "string" && cell.children.get(key)?.present()
            ? { enumerable: true, configurable: true }
            : undefined,
        set: () => {
          throw new FormworkError("INVALID_OPERATION", "表达式值通过 bindings.value 写入");
        },
      },
    );
  const array = (cell: Cell): unknown =>
    new Proxy([], {
      get(_target, key) {
        const items = cell.entries();
        if (key === "length") return items.length;
        if (key === "toJSON") return () => cell.snapshot();
        if (typeof key === "string" && /^(0|[1-9]\d*)$/u.test(key))
          return items[Number(key)] ? read(items[Number(key)]!) : undefined;
        if (key === Symbol.iterator)
          return function* () {
            for (const item of items) yield read(item);
          };
        const method = Reflect.get(Array.prototype, key);
        if (typeof method === "function")
          return (...args: unknown[]) => method.apply(items.map(read), args);
        return undefined;
      },
      has: (_target, key) =>
        typeof key === "string" &&
        /^(0|[1-9]\d*)$/u.test(key) &&
        Number(key) < cell.entries().length,
      set: () => {
        throw new FormworkError("INVALID_OPERATION", "表达式不能改变数组");
      },
    });
  return "properties" in root.schema ? object(root) : read(root);
}

/** 为属性建立独立表达式轮次和 writer 依赖，保留普通代码 props 的身份。 */
export function expressionProperty(
  input: unknown,
  ctx: ActionContext,
  scope: ValueScope,
  field?: Cell,
  write = false,
) {
  const [value, setValue] = createSignal<unknown>();
  const [errors, setErrors] = createSignal<readonly ValidationIssue[]>([]);
  if (!expressionBody(input)) {
    setValue(() => input);
    return { value, errors };
  }
  const root = scopeCell(scope);
  const graph = graphFor(root);
  const writer: Writer | undefined =
    write && field ? { target: field, dependencies: new Set() } : undefined;
  if (writer) {
    if (graph.has(writer.target))
      throw new FormworkError(
        "EXPRESSION_CYCLE",
        `同一字段有多个 value writer: ${writer.target.path()}`,
      );
    graph.set(writer.target, writer);
  }
  let alive = true;
  let round = 0;
  onCleanup(() => {
    alive = false;
    round++;
    if (writer) graph.delete(writer.target);
  });
  compileExpression(input as string);
  // with 仅用于可信 JS 上下文的惰性 getter，避免未读取的 $value 产生自依赖。
  const body = expressionBody(input)!;
  let program = environmentPrograms.get(body);
  if (!program) {
    program = new Function("$environment", `with ($environment) { return (${body}); }`) as (
      environment: unknown,
    ) => unknown;
    environmentPrograms.set(body, program);
  }
  const problem = (error: unknown) => {
    const code = error instanceof FormworkError ? error.code : "EXPRESSION_FAILED";
    setErrors([
      {
        path: field ? field.path().slice(root.path().length) : "",
        code,
        message: error instanceof Error ? error.message : String(error),
      },
    ]);
  };
  createComputed(() => {
    const current = ++round;
    const fieldVersion = field?.version;
    const dependencies = new Set<Cell>();
    let collecting = true;
    const observe = (cell: Cell) => {
      if (collecting) dependencies.add(cell);
    };
    const valid = () =>
      alive &&
      root.alive &&
      !ctx.signal.aborted &&
      current === round &&
      (!field || field.alive) &&
      (!writer || field?.version === fieldVersion);
    const apply = (next: unknown) => {
      if (!valid()) return;
      try {
        if (writer) {
          writer.dependencies = dependencies;
          checkGraph(graph);
          const before = untrack(() => field!.snapshot());
          if (JSON.stringify(before) !== JSON.stringify(next))
            untrack(() => {
              field!.assertWritable();
              field!.materializeParents();
              field!.replace(cloneJson(next as JsonValue));
              field!.changed();
            });
        }
        setValue(() => next);
        setErrors([]);
      } catch (error) {
        problem(error);
      }
    };
    try {
      const result = program!({
        $ctx: ctx,
        $schema: ctx.schema,
        $values: valuesProxy(root, observe),
        get $value() {
          if (field) {
            observe(field);
            return field.snapshot();
          }
          return undefined;
        },
        $field: field
          ? {
              get path() {
                return field.path().slice(root.path().length);
              },
              schema: field.schema,
            }
          : undefined,
        fn: new Proxy(ctx.fn, {
          get(target, key) {
            if (typeof key === "string" && !Object.hasOwn(target, key))
              throw new FormworkError("INVALID_EXPRESSION", `函数不存在 fn.${key}`);
            return Reflect.get(target, key);
          },
        }),
      });
      collecting = false;
      if (writer) {
        writer.dependencies = dependencies;
        checkGraph(graph);
      }
      if (result && typeof (result as PromiseLike<unknown>).then === "function")
        Promise.resolve(result).then(apply, (error) => {
          if (valid()) problem(error);
        });
      else if (typeof result === "function")
        apply((...args: unknown[]) => (valid() ? result(...args) : undefined));
      else apply(result);
    } catch (error) {
      collecting = false;
      problem(error);
    }
  });
  return { value, errors };
}
