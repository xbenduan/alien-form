/**
 * @alien-form/core — Expression safety filter
 *
 * Schema-driven `expression` rules are executed via `new Function(...)` against
 * a curated scope. Schemas are assumed to come from a trusted distribution
 * channel; the filter below is a defense-in-depth lint, not a sandbox. It
 * rejects the most common ways to escape into globals or build new functions
 * inside an expression.
 */

const UNSAFE_EXPRESSION_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern:
      /(^|[^.$\w])(?:globalThis|window|document|process|Function|eval|constructor|prototype|__proto__)(?=$|[^$\w])/u,
    message: 'global or reflective access is not allowed',
  },
  {
    pattern: /=>|\bfunction\b|\bclass\b|\bnew\b/u,
    message: 'function/class construction is not allowed',
  },
  {
    pattern: /(?:^|[^=!<>])=(?!=)/u,
    message: 'assignment is not allowed in expressions',
  },
  {
    pattern: /;|`/u,
    message: 'statements and template literals are not allowed in expressions',
  },
]

export function assertSafeExpression(expr: string): void {
  for (const rule of UNSAFE_EXPRESSION_PATTERNS) {
    if (rule.pattern.test(expr)) {
      throw new Error(`Unsafe expression rejected: ${rule.message}`)
    }
  }
}
