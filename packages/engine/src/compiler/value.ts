import { compileExpr } from "@alien-form/core";
import type { ExpressionScope } from "@alien-form/core";
import type { CompiledValue } from "../protocol";

const COMPILED_VALUE = Symbol("alien-form.compiled-value");

type BrandedCompiledValue = CompiledValue & {
  readonly [COMPILED_VALUE]: true;
};

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isRuntimeExpression(value: unknown): value is string {
  return typeof value === "string" && value.trim().startsWith("{{") && value.trim().endsWith("}}");
}

export function createCompiledValue(expression: string): CompiledValue {
  const compiled: BrandedCompiledValue = {
    [COMPILED_VALUE]: true,
    expression: compileExpr(expression),
  };
  return compiled;
}

export function compileRuntimeValue<T>(value: T): T {
  if (isRuntimeExpression(value)) return createCompiledValue(value) as T;
  if (Array.isArray(value)) return value.map(compileRuntimeValue) as T;
  if (!value || typeof value !== "object" || !isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, compileRuntimeValue(child)]),
  ) as T;
}

export function isCompiledValue(value: unknown): value is CompiledValue {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Partial<BrandedCompiledValue>)[COMPILED_VALUE] === true
  );
}

export function containsCompiledValue(value: unknown): boolean {
  if (isCompiledValue(value)) return true;
  if (Array.isArray(value)) return value.some(containsCompiledValue);
  if (!value || typeof value !== "object" || !isPlainObject(value)) return false;
  return Object.values(value).some(containsCompiledValue);
}

export function evaluateCompiledValue<T>(value: T, scope: Record<string, unknown>): T {
  if (isCompiledValue(value)) {
    return value.expression(scope as unknown as ExpressionScope) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => evaluateCompiledValue(item, scope)) as T;
  }
  if (!value || typeof value !== "object" || !isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, evaluateCompiledValue(child, scope)]),
  ) as T;
}
