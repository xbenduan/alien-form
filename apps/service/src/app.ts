import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { errorPayload, FormworkError, isObject } from "formwork/model";
import type { ModelDocument } from "formwork/model";
import { createModelStore } from "./model-store.js";
import { createRecordStore } from "./record-store.js";

function guard(request: IncomingMessage) {
  let host: URL;
  try {
    host = new URL(`http://${request.headers.host ?? ""}`);
  } catch {
    throw new FormworkError("FORBIDDEN", "需要有效 Host");
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host.hostname))
    throw new FormworkError("FORBIDDEN", "仅接受 loopback Host");
  if (request.method !== "GET") {
    if (
      request.headers.origin
        ? request.headers.origin !== host.origin
        : request.headers["x-formwork-tool"] !== "1"
    )
      throw new FormworkError("FORBIDDEN", "写请求需要同源 Origin 或本地工具标识");
  }
}
async function json(request: IncomingMessage): Promise<unknown> {
  let length = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    length += bytes.length;
    if (length > 2 * 1024 * 1024) throw new FormworkError("INVALID_INPUT", "请求超过 2 MiB");
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new FormworkError("INVALID_INPUT", "请求必须是 JSON");
  }
}
function send(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}
/** 创建只监听 loopback 的开发 HTTP 服务及其独立文件源。 */
export function createDevelopmentService(dataDir: string) {
  const models = createModelStore(dataDir);
  const records = createRecordStore(dataDir, models);
  const server = createServer((request, response) => {
    void (async () => {
      try {
        guard(request);
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        if (request.method === "GET" && url.pathname === "/health") {
          send(response, 200, { ready: true });
          return;
        }
        const parts = url.pathname.split("/").slice(1).map(decodeURIComponent);
        if (parts[0] !== "api") throw new FormworkError("NOT_FOUND", "接口不存在");
        if (parts[1] === "models") {
          if (request.method === "GET" && parts.length === 2)
            send(response, 200, await models.list());
          else if (parts.length === 3 && request.method === "GET")
            send(response, 200, await models.read(parts[2]!));
          else if (parts.length === 3 && request.method === "PUT") {
            const body = await json(request);
            if (!isObject(body) || !isObject(body.document) || body.document.id !== parts[2])
              throw new FormworkError("INVALID_MODEL", "path/document id 必须一致");
            const controller = new AbortController();
            request.once("aborted", () => controller.abort());
            send(
              response,
              200,
              await models.write(body.document as ModelDocument, {
                ifRevision: body.ifRevision as string | null,
                signal: controller.signal,
              }),
            );
          } else throw new FormworkError("NOT_FOUND", "接口不存在");
        } else if (parts[1] === "records" && parts[2]) {
          const modelId = parts[2],
            id = parts[3];
          if (parts.length === 4 && id === "query" && request.method === "POST")
            send(response, 200, await records.query(modelId, await json(request)));
          else if (parts.length === 3 && request.method === "POST")
            send(response, 201, await records.create(modelId, await json(request)));
          else if (parts.length === 4 && id && request.method === "GET")
            send(response, 200, await records.read(modelId, id));
          else if (parts.length === 4 && id && request.method === "PUT")
            send(response, 200, await records.update(modelId, id, await json(request)));
          else if (parts.length === 4 && id && request.method === "DELETE")
            send(response, 200, await records.remove(modelId, id));
          else throw new FormworkError("NOT_FOUND", "接口不存在");
        } else throw new FormworkError("NOT_FOUND", "接口不存在");
      } catch (error) {
        const payload = errorPayload(error);
        const status =
          (
            {
              NOT_FOUND: 404,
              FORBIDDEN: 403,
              READ_ONLY: 403,
              REVISION_CONFLICT: 409,
              INTERNAL_ERROR: 500,
            } as Record<string, number>
          )[payload.code] ?? 400;
        send(response, status, { error: payload });
      }
    })();
  });
  return {
    models,
    records,
    async listen(port = 8788) {
      await new Promise<void>((done, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => {
          server.removeListener("error", reject);
          done();
        });
      });
      return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    },
    async close() {
      await new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
    },
  };
}
