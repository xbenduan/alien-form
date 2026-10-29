import { FormworkError } from "../model/errors";
import { createFormworkApi } from "../model/http";
import { toolInputSchemas } from "./tools";
import type { ModelToolName } from "./tools";

/** 配置直连 Worker 的 credential；token 不进入 URL。 */
export type ToolClientOptions = { token?: () => string | undefined; fetch?: typeof fetch };
/** 将六项 MCP 工具直接映射到 Worker HTTP API。 */
export function createToolClient(url: string, options: ToolClientOptions = {}) {
  const base = new URL(url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (
    (base.protocol !== "https:" && !(local && base.protocol === "http:")) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !["", "/", "/api/v1", "/api/v1/"].includes(base.pathname)
  )
    throw new FormworkError(
      "FORBIDDEN",
      "MCP URL 必须是 localhost HTTP 或远端 HTTPS Worker origin",
    );
  const api = createFormworkApi({ url: `${base.origin}/api/v1`, ...options });
  return {
    async call(name: ModelToolName, input: unknown, signal?: AbortSignal): Promise<unknown> {
      try {
        switch (name) {
          case "models.list":
            toolInputSchemas[name].parse(input);
            return await api.models.list({ signal });
          case "models.read": {
            const args = toolInputSchemas[name].parse(input);
            return await api.models.read(args.modelId, { signal });
          }
          case "formwork.capabilities": {
            const args = toolInputSchemas[name].parse(input);
            return await api.capabilities(args.modelId, args.router, { signal });
          }
          case "models.validate": {
            const args = toolInputSchemas[name].parse(input);
            return await api.models.validate(args.modelId, args.definition, args.router, {
              signal,
            });
          }
          case "models.write": {
            const args = toolInputSchemas[name].parse(input);
            return await api.models.saveDraft(args.modelId, args.definition, {
              ifRevision: args.ifRevision,
              signal,
            });
          }
          case "models.preview": {
            const args = toolInputSchemas[name].parse(input);
            return await api.models.preview(args.modelId, args.router, args.params, { signal });
          }
          default:
            throw new FormworkError("NOT_FOUND", `未知工具 ${name}`);
        }
      } catch (error) {
        if (signal?.aborted) throw new FormworkError("ABORTED", "操作已取消");
        if (error instanceof TypeError)
          throw new FormworkError("API_UNAVAILABLE", `无法连接 Worker ${base.origin}`);
        throw error;
      }
    },
  };
}
