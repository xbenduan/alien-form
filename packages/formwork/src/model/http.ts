import { checkAbort, FormworkError } from "./errors";
import { isObject } from "./pointer";
import { assertSnapshot, modelIdPattern } from "./schema";
import type { ModelEntry, ModelSource } from "./types";

/** 配置完整模型 HTTP Adapter，可注入带认证的 fetch。 */
export type HttpModelSourceOptions = { url: string; fetch?: typeof fetch; headers?: HeadersInit };
/** 通过真实 HTTP 读取完整模型，并把条件写入交给服务器执行。 */
export function createHttpModelSource(options: HttpModelSourceOptions): ModelSource {
  const request = async (suffix: string, signal?: AbortSignal, body?: unknown) => {
    checkAbort(signal);
    const response = await (options.fetch ?? fetch)(`${options.url.replace(/\/$/u, "")}${suffix}`, {
      method: body === undefined ? "GET" : "PUT",
      signal,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(new Headers(options.headers)),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      const error = isObject(result) && isObject(result.error) ? result.error : {};
      throw new FormworkError(
        String(error.code ?? "HTTP_ERROR"),
        String(error.message ?? `HTTP ${response.status}`),
        Array.isArray(error.issues) ? error.issues : [],
      );
    }
    return result;
  };
  const idPath = (id: string) => {
    if (!modelIdPattern.test(id)) throw new FormworkError("INVALID_MODEL", `无效 modelId ${id}`);
    return `/${encodeURIComponent(id)}`;
  };
  return {
    async list(settings) {
      const result = await request("", settings?.signal);
      if (!Array.isArray(result))
        throw new FormworkError("INVALID_MODEL", "目录必须是 ModelEntry[]");
      const seen = new Set<string>();
      for (const entry of result) {
        if (
          !isObject(entry) ||
          typeof entry.id !== "string" ||
          !modelIdPattern.test(entry.id) ||
          seen.has(entry.id) ||
          typeof entry.title !== "string" ||
          typeof entry.revision !== "string" ||
          !entry.revision ||
          typeof entry.writable !== "boolean" ||
          !isObject(entry.location) ||
          !(
            (entry.location.kind === "local" && typeof entry.location.path === "string") ||
            (entry.location.kind === "remote" && typeof entry.location.uri === "string")
          )
        )
          throw new FormworkError("INVALID_MODEL", "目录含无效或重复的 ModelEntry");
        seen.add(entry.id);
      }
      return [...(result as ModelEntry[])].sort((a, b) => a.id.localeCompare(b.id));
    },
    async read(id, settings) {
      return assertSnapshot(await request(idPath(id), settings?.signal), id);
    },
    async write(document, settings) {
      return assertSnapshot(
        await request(idPath(document.id), settings.signal, {
          document,
          ifRevision: settings.ifRevision,
        }),
        document.id,
      );
    },
  };
}
