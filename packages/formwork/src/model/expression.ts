import { FormworkError } from "./errors";

const expressionPattern = /^\{\{([\s\S]*)\}\}$/u;
const programs = new Map<string, (...args: unknown[]) => unknown>();
/** 提取完整的可信 JavaScript 表达式；普通字符串原样保留。 */
export function expressionBody(value: unknown): string | undefined {
  return typeof value === "string" ? expressionPattern.exec(value.trim())?.[1]?.trim() : undefined;
}

/** 编译可信表达式，复用无状态程序，不在编译时调用函数或网络。 */
export function compileExpression(value: string): (...args: unknown[]) => unknown {
  const body = expressionBody(value);
  if (!body) throw new FormworkError("INVALID_EXPRESSION", "表达式必须是完整的 {{ ... }}");
  let program = programs.get(body);
  if (!program) {
    try {
      program = new Function(
        "$ctx",
        "$model",
        "$values",
        "$value",
        "$field",
        "fn",
        `"use strict"; return (${body});`,
      ) as (...args: unknown[]) => unknown;
    } catch (error) {
      throw new FormworkError(
        "INVALID_EXPRESSION",
        error instanceof Error ? error.message : String(error),
      );
    }
    programs.set(body, program);
  }
  return program;
}
