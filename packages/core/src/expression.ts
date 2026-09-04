import type { ExpressionScope } from "./types";

export type CompiledExpression<T = unknown> = (scope: ExpressionScope) => T;

const expressionCache = new Map<string, CompiledExpression>();

function unwrapExpression(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("{{") && trimmed.endsWith("}}") ? trimmed.slice(2, -2).trim() : trimmed;
}

/**
 * Compiles a schema expression once. Scope names remain explicit protocol
 * globals while JavaScript syntax, calls and arrow functions stay available.
 */
export function compileExpr<T = unknown>(raw: string): CompiledExpression<T> {
  const source = unwrapExpression(raw);
  const cached = expressionCache.get(source);
  if (cached) return cached as CompiledExpression<T>;

  const evaluate = new Function(
    "scope",
    `const {
      mode,
      $values,
      $self,
      $form,
      $value,
      $row,
      $path,
      $service,
      $utils,
      $enum,
      $query
    } = scope;
    return (${source});`,
  ) as CompiledExpression<T>;

  expressionCache.set(source, evaluate);
  return evaluate;
}

export function evaluateExpression<T = unknown>(raw: string, scope: ExpressionScope): T {
  return compileExpr<T>(raw)(scope);
}
