import type { RuntimeRuleContext } from "@alien-form/react";

/**
 * 多值组件（多选 / 标签 / 复选组）值为数组，但 alien-form 的叶子字段只接受
 * string | number | boolean。用 x-format 在叶子上做双向桥接：
 *  - input:  数组 → JSON 字符串（存入 signal）
 *  - output: JSON 字符串 → 数组（投影回真实值）
 */
export function serializeMultiValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "string") return value;
  return JSON.stringify([value]);
}

export function parseMultiValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export const multiValueFormat = {
  input: (ctx: RuntimeRuleContext) => serializeMultiValue(ctx.value),
  output: (ctx: RuntimeRuleContext) => parseMultiValue(ctx.value),
};
