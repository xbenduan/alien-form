import { createSignal } from "solid-js";
import { FormworkError } from "../model/errors";
import { defaultOperator, normalizeClause, operandSchema, queryClauseIssues } from "../model/query";
import type { ResolvedModel } from "../model/field";
import type { JsonValue, QueryClause, QueryOperator, ValidationIssue } from "../model/types";
import type { FilterBinding } from "./types";

/** 管理与记录 scope 完全独立的过滤条件，只有 active 条件参与提交。 */
export function createQueryState(model: ResolvedModel) {
  const bindings = new Map<string, FilterBinding>();
  for (const field of model.fields) {
    const allowed = field.capabilities?.filter ?? [];
    if (!allowed.length) continue;
    const [active, setActive] = createSignal(false);
    const [operator, setOperator] = createSignal(defaultOperator(field.schema, allowed));
    const [value, setValue] = createSignal<JsonValue>();
    const [errors, setErrors] = createSignal<readonly ValidationIssue[]>([]);
    bindings.set(field.path, {
      kind: "filter",
      path: () => field.path,
      active,
      setActive: (enabled) => {
        setActive(enabled);
        setErrors([]);
      },
      operator,
      setOperator(next: QueryOperator) {
        if (!allowed.includes(next))
          throw new FormworkError("UNSUPPORTED_OPERATOR", `不支持 ${next}`);
        setOperator(next);
        setValue(undefined);
        setErrors([]);
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
        setErrors([]);
      },
      errors: () => {
        if (!active()) return errors();
        return queryClauseIssues(
          field.schema,
          allowed,
          normalizeClause(field.path, operator(), value()),
        );
      },
      readOnly: () => false,
    });
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
