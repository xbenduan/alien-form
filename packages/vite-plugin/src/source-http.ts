import type { IncomingMessage, ServerResponse } from "node:http";
import { checkAbort, errorPayload, FormworkError } from "formwork/model";
import type { ModelDocument, ModelSource } from "formwork/model";

/** 检查 loopback Host；浏览器写入必须同源，stdio 请求必须带本地工具标识。 */
export function guardRequest(request: IncomingMessage, write: boolean): void {
  const host = request.headers.host;
  let target: URL;
  try { target = new URL(`http://${host ?? ""}`); }
  catch { throw new FormworkError("FORBIDDEN", "缺少有效 Host"); }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) throw new FormworkError("FORBIDDEN", "仅接受 loopback Host");
  if (write) {
    if (request.headers.origin) {
      if (request.headers.origin !== target.origin) throw new FormworkError("FORBIDDEN", "拒绝跨源写入");
    } else if (request.headers["x-formwork-tool"] !== "1") throw new FormworkError("FORBIDDEN", "无 Origin 的请求需要本地工具标识");
  }
}

/** 读取有限大小的 JSON 请求；客户端断开或超限时不进入写入。 */
export async function readJson(request: IncomingMessage, signal?: AbortSignal): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    checkAbort(signal);
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > 2 * 1024 * 1024) throw new FormworkError("INVALID_MODEL", "请求超过 2 MiB");
    chunks.push(bytes);
  }
  checkAbort(signal);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new FormworkError("INVALID_MODEL", "请求必须是有效 JSON"); }
}

/** 输出约定 JSON；开发接口与工具共用相同错误结构。 */
export function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(value));
}

/** 将框架错误映射为 HTTP 状态，保留 code 与 Pointer。 */
export function sendError(response: ServerResponse, error: unknown): void {
  const payload = errorPayload(error);
  const status = { NOT_FOUND: 404, FORBIDDEN: 403, READ_ONLY: 403, REVISION_CONFLICT: 409, ABORTED: 499, INTERNAL_ERROR: 500 }[payload.code] ?? 400;
  sendJson(response, status, { error: payload });
}

/** 将浏览器和 MCP 的本地完整模型操作转交给同一个文件源。 */
export function createSourceMiddleware(source: ModelSource): (request: IncomingMessage, response: ServerResponse) => Promise<boolean> {
  return async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/__formwork/models" && !url.pathname.startsWith("/__formwork/models/")) return false;
    const controller = new AbortController();
    request.once("aborted", () => controller.abort());
    try {
      guardRequest(request, request.method !== "GET");
      const suffix = url.pathname.slice("/__formwork/models".length);
      if (request.method === "GET" && suffix === "") sendJson(response, 200, await source.list({ signal: controller.signal }));
      else {
        const id = decodeURIComponent(suffix.slice(1));
        if (!id || suffix.slice(1).includes("/")) throw new FormworkError("NOT_FOUND", "接口不存在");
        if (request.method === "GET") sendJson(response, 200, await source.read(id, { signal: controller.signal }));
        else if (request.method === "PUT") {
          const body = await readJson(request, controller.signal) as { document?: ModelDocument; ifRevision?: string | null };
          if (!body?.document || body.document.id !== id) throw new FormworkError("INVALID_MODEL", "请求 id 与 document.id 不一致");
          sendJson(response, 200, await source.write(body.document, { ifRevision: body.ifRevision as string | null, signal: controller.signal }));
        } else throw new FormworkError("NOT_FOUND", "接口不存在");
      }
    } catch (error) { sendError(response, error); }
    return true;
  };
}
