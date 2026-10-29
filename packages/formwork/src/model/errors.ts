import type { Diagnostic } from "./types";

/** 保留跨文件源、HTTP 与工具传输的错误 code 和定位。 */
export class FormworkError extends Error {
  readonly code: string;
  readonly issues: readonly Diagnostic[];
  constructor(code: string, message: string, issues: readonly Diagnostic[] = []) {
    super(message);
    this.name = "FormworkError";
    this.code = code;
    this.issues = issues;
  }
}

/** 在提交前明确终止已经取消的操作。 */
export function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new FormworkError("ABORTED", "操作已取消");
}

/** 将未知异常转换成可以通过 HTTP 或 MCP 传输的错误。 */
export function errorPayload(error: unknown): { code: string; message: string; issues?: readonly Diagnostic[] } {
  if (error instanceof FormworkError) return { code: error.code, message: error.message, issues: error.issues };
  if (error instanceof Error && error.name === "AbortError") return { code: "ABORTED", message: "操作已取消" };
  return { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : String(error) };
}
