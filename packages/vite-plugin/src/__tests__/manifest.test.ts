import { afterEach, expect, test } from "vitest";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { CapabilityManifest } from "formwork/model";
import { registerManifest } from "../manifest";

const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
});
const manifest = {
  appId: "alien-form",
  revision: "a".repeat(64),
  clientOrigin: "http://localhost:5173",
} as CapabilityManifest;
async function endpoint(status: number, body: string) {
  const requests: { method?: string; url?: string; body: string }[] = [];
  const server = createServer(async (request, response) => {
    let received = "";
    for await (const chunk of request) received += String(chunk);
    requests.push({ method: request.method, url: request.url, body: received });
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(body);
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return { origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, requests };
}
test("真实 HTTP 422 日志包含服务端模型诊断，并遮蔽响应中的 deploy credential", async () => {
  const token = "DEPLOY_CREDENTIAL_SENTINEL";
  const { origin, requests } = await endpoint(
    422,
    JSON.stringify({
      error: {
        code: "INVALID_MODEL",
        message: `清单变更使已发布模型 cms 失效 ${token}`,
        issues: [
          {
            path: "/document/views/edit",
            code: "UNKNOWN_ROUTER",
            modelId: "cms",
            message: `目标 Domain 不存在 ${token}`,
          },
        ],
      },
    }),
  );
  const error = await registerManifest(`${origin}/api/v1/`, token, manifest).catch(
    (value: unknown) => value,
  );
  expect(error).toBeInstanceOf(Error);
  const message = (error as Error).message;
  expect(message).toContain("HTTP 422");
  expect(message).toContain("INVALID_MODEL");
  expect(message).toContain("清单变更使已发布模型 cms 失效");
  expect(message).toContain("/document/views/edit");
  expect(message).toContain("UNKNOWN_ROUTER");
  expect(message).toContain("目标 Domain 不存在");
  expect(message).not.toContain(token);
  expect(requests).toEqual([
    {
      method: "PUT",
      url: "/api/v1/formwork/capabilities/alien-form",
      body: JSON.stringify({
        revision: manifest.revision,
        manifest,
        origin: manifest.clientOrigin,
      }),
    },
  ]);
});
test("非 JSON 错误响应保留 HTTP 状态，成功登记正常返回", async () => {
  const failed = await endpoint(502, "<html>Bad Gateway</html>");
  await expect(registerManifest(failed.origin, "token", manifest)).rejects.toThrow("HTTP 502");
  const success = await endpoint(200, '{"registered":true}');
  await expect(registerManifest(success.origin, "token", manifest)).resolves.toBeUndefined();
});
