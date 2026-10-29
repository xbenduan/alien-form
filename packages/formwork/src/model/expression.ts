import { FormworkError } from "./errors";
import { parse } from "acorn";

const expressionPattern = /^\{\{([\s\S]*)\}\}$/u;
const programs = new Map<string, (...args: unknown[]) => unknown>();
/** 提取完整的可信 JavaScript 表达式；普通字符串原样保留。 */
export function expressionBody(value: unknown): string | undefined {
  return typeof value === "string" ? expressionPattern.exec(value.trim())?.[1]?.trim() : undefined;
}

/** 只解析表达式语法，可在 Worker 中执行，不调用 eval 或应用函数。 */
export function validateExpression(value: string): void {
  const body = expressionBody(value);
  if (!body) throw new FormworkError("INVALID_EXPRESSION", "表达式必须是完整的 {{ ... }}");
  try {
    const program = parse(`"use strict"; (${body});`, { ecmaVersion: "latest" });
    if (program.body.length !== 2 || program.body[1]?.type !== "ExpressionStatement")
      throw new Error("需要单一表达式");
  } catch (error) {
    throw new FormworkError(
      "INVALID_EXPRESSION",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** 编译可信表达式，复用无状态程序，不在编译时调用函数或网络。 */
export function compileExpression(value: string): (...args: unknown[]) => unknown {
  const body = expressionBody(value);
  if (!body) throw new FormworkError("INVALID_EXPRESSION", "表达式必须是完整的 {{ ... }}");
  let program = programs.get(body);
  if (!program) {
    validateExpression(value);
    try {
      program = new Function(
        "$ctx",
        "$schema",
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
