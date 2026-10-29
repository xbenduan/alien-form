/// <reference types="node" />
import { expect, it } from "vitest";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

it("官方 SDK stdio 使用 Bearer 直连 API 并保留管理诊断和结构化错误", async () => {
  const snapshot = {
    id: "orders",
    title: "未完成",
    revision: "draft-1",
    stage: "draft",
    publishedVersion: null,
    baseVersion: null,
    canManage: true,
    canPublish: false,
    definition: { document: { id: "orders" } },
    diagnostics: {
      errors: [{ path: "/document/data", code: "INVALID_MODEL", message: "缺少 data" }],
      runtimeChecks: [],
    },
  };
  const paths: string[] = [];
  const server = createServer((request, response) => {
    paths.push(request.url!);
    response.setHeader("Content-Type", "application/json");
    if (request.headers.authorization !== "Bearer test-agent-credential") {
      response.statusCode = 401;
      response.end(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "缺少 token" } }));
    } else if (request.url === "/api/v1/models") {
      const {
        definition: _definition,
        baseVersion: _base,
        diagnostics: _diagnostics,
        ...entry
      } = snapshot;
      response.end(JSON.stringify([entry]));
    } else if (request.url === "/api/v1/models/orders") {
      response.end(JSON.stringify(snapshot));
    } else {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: { code: "UNKNOWN_ROUTER", message: "未知 router" } }));
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      resolve("packages/formwork/dist/stdio.js"),
      "--url",
      `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    ],
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
      FORMWORK_API_TOKEN: "test-agent-credential",
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "formwork-test", version: "1" });
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual([
      "models.list",
      "models.read",
      "formwork.capabilities",
      "models.validate",
      "models.write",
      "models.preview",
    ]);
    const read = await client.callTool({ name: "models.read", arguments: { modelId: "orders" } });
    const text = (read.content as Array<{ text: string }>)[0]!.text;
    expect(JSON.parse(text)).toMatchObject({
      stage: "draft",
      revision: "draft-1",
      diagnostics: snapshot.diagnostics,
    });
    const error = await client.callTool({
      name: "models.preview",
      arguments: { modelId: "orders", router: "missing" },
    });
    expect(error.isError).toBe(true);
    expect(JSON.parse((error.content as Array<{ text: string }>)[0]!.text).error.code).toBe(
      "UNKNOWN_ROUTER",
    );
    expect(paths.every((path) => path.startsWith("/api/v1/"))).toBe(true);
  } finally {
    await client.close();
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
});
