import { createSignal } from "solid-js";
import { FormworkError } from "../model/errors";
import { defaultOperator, normalizeClause, operandSchema, queryClauseIssues } from "../model/query";
import type { FieldDescriptor, ResolvedModel } from "../model/field";
import type { JsonValue, QueryClause, QueryOperator } from "../model/types";
import type { FilterBinding } from "./types";

/** 为一条筛选条件创建独立绑定，同一字段可多次绑定而不共享值或操作符。 */
export function createFilterBinding(field: FieldDescriptor): FilterBinding {
  const allowed = field.capabilities?.filter ?? [];
  if (!allowed.length) throw new FormworkError("UNKNOWN_FIELD", `字段不可筛选 ${field.path}`);
  const [active, setActive] = createSignal(false);
  const [operator, setOperator] = createSignal(defaultOperator(field.schema, allowed));
  const [value, setValue] = createSignal<JsonValue>();
  return {
    kind: "filter",
    path: () => field.path,
    active,
    setActive,
    operator,
    setOperator(next: QueryOperator) {
      if (!allowed.includes(next))
        throw new FormworkError("UNSUPPORTED_OPERATOR", `不支持 ${next}`);
      setOperator(next);
      setValue(undefined);
    },
    operandSchema: () => operandSchema(field.schema, operator()),
    value,
    set(next) {
      if (next === null && operator() === "eq") {
        if (!allowed.includes("isNull"))
          throw new FormworkError("UNSUPPORTED_OPERATOR", "不支持筛选空值");
        setOperator("isNull");
        setValue(undefined);
      } else setValue(() => next);
      setActive(true);
    },
    errors: () =>
      active()
        ? queryClauseIssues(field.schema, allowed, normalizeClause(field.path, operator(), value()))
        : [],
    readOnly: () => false,
  };
}

/** 管理与记录 scope 完全独立的过滤条件，只有 active 条件参与提交。 */
export function createQueryState(model: ResolvedModel) {
  const bindings = new Map<string, FilterBinding>();
  for (const field of model.fields) {
    if (field.capabilities?.filter.length) bindings.set(field.path, createFilterBinding(field));
  }
  return {
    fields: [...bindings.values()],
    field(pointer: string): FilterBinding {
      const binding = bindings.get(pointer);
      if (!binding) throw new FormworkError("UNKNOWN_FIELD", `字段不可筛选 ${pointer}`);
      return binding;
    },
    clauses(): QueryClause[] {
      const active = [...bindings.values()].filter((binding) => binding.active());
      const issues = active.flatMap((binding) => binding.errors());
      if (issues.length) throw new FormworkError("INVALID_QUERY", "筛选条件无效", issues);
      return active.map((binding) =>
        normalizeClause(binding.path(), binding.operator(), binding.value()),
      );
    },
    reset() {
      for (const binding of bindings.values()) {
        binding.setOperator(
          defaultOperator(
            model.field(binding.path()).schema,
            model.field(binding.path()).capabilities!.filter,
          ),
        );
        binding.setActive(false);
      }
    },
  };
}
