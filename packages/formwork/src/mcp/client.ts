import { FormworkError } from "../model/errors";
import type { ModelToolName } from "./tools";

/** 只连接 loopback 上已有的 Vite 服务，不创建独立模型写入源。 */
export function createToolClient(url: string) {
  const base = new URL(url);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) ||
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password
  )
    throw new FormworkError("FORBIDDEN", "MCP 仅连接 loopback 开发服务");
  return {
    async call(name: ModelToolName, input: unknown, signal?: AbortSignal): Promise<unknown> {
      let response: Response;
      try {
        response = await fetch(new URL(`/__formwork/tools/${encodeURIComponent(name)}`, base), {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Formwork-Tool": "1" },
          body: JSON.stringify(input),
          signal,
        });
      } catch (error) {
        if (signal?.aborted) throw new FormworkError("ABORTED", "操作已取消");
        throw new FormworkError(
          "DEV_SERVER_UNAVAILABLE",
          `无法连接 Vite 开发服务 ${base.origin}: ${String(error)}`,
        );
      }
      const body = (await response.json()) as {
        error?: { code: string; message: string; issues?: never[] };
      };
      if (!response.ok || body.error)
        throw new FormworkError(
          body.error?.code ?? "HTTP_ERROR",
          body.error?.message ?? `HTTP ${response.status}`,
          body.error?.issues,
        );
      return body;
    },
  };
}
