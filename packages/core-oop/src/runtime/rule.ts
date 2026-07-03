import type { RuntimeContext, SchemaRule } from "../schema";
import { compile } from "./compile";
import { buildScope } from "./context";

/** rule 求值所属命名空间，决定 `@name` 查哪张 handlers 表及其调用签名。 */
export type RuleNamespace = "reactions" | "effects" | "formats" | "validators";

/**
 * 判断字符串是否为 `{{ expr }}` 表达式形态。
 */
function isExpression(s: string): boolean {
  return s.startsWith("{{") && s.endsWith("}}");
}

/**
 * 剥离 `{{` `}}` 取出内部表达式体。
 */
function unwrapExpression(s: string): string {
  return s.slice(2, -2).trim();
}

/**
 * 统一求值一条 SchemaRule（用于 x-reactions / x-effect / x-format / x-validators 的 SchemaRule 形态）。
 * 分派三种字符串语义：`{{expr}}` 表达式、`@name` 具名处理器、其它字面量；函数直接调用；其余原样返回。
 * value 仅对 formats / validators 命名空间有意义（其 handler 签名为 `(value, ctx)`）。
 */
export function executeRule(
  rule: SchemaRule,
  ctx: RuntimeContext,
  namespace: RuleNamespace,
  value?: any,
): any {
  if (typeof rule === "function") {
    return (rule as (ctx: RuntimeContext) => any)(ctx);
  }
  const withValue = namespace === "formats" || namespace === "validators";
  if (typeof rule === "string") {
    if (isExpression(rule)) {
      const scope = withValue ? buildScope(ctx, value) : buildScope(ctx);
      return compile(unwrapExpression(rule))(scope);
    }
    if (rule.startsWith("@")) {
      const name = rule.slice(1);
      const table = (ctx.handlers as any)[namespace] as
        | Record<string, (...args: any[]) => any>
        | undefined;
      const handler = table?.[name];
      if (!handler) return undefined;
      return withValue ? handler(value, ctx) : handler(ctx);
    }
  }
  return rule;
}
