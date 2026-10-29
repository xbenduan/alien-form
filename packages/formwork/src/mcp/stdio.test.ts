/// <reference types="node" />
import { expect, it } from "vitest";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createModelTools } from "formwork/mcp";
import { createReadonlyModelSource } from "formwork/model";
import { readJson, sendError, sendJson } from "../../../vite-plugin/src/source-http";

it("官方 SDK stdio round trip 连接已有服务并报告结构化错误", async () => {
  const source = createReadonlyModelSource([
    {
      id: "orders",
      title: "订单",
      revision: "1",
      location: { kind: "local", path: "model.json" },
      writable: false,
      completeness: "full",
      document: { id: "orders", title: "订单", data: { type: "object", properties: {} } },
    },
  ]);
  const tools = createModelTools({
    source,
    routes: [
      { router: "models", path: "/models/:domain?" },
      { router: "list", path: "/list/:domain" },
    ],
    schemaRouters: ["list"],
    capabilities: (modelId, router) => ({
      modelId,
      router,
      components: [],
      fn: [],
      modelContract: "ModelDocument",
      runtimeChecks: [],
    }),
  });
  const server = createServer((request, response) => {
    void (async () => {
      try {
        sendJson(
          response,
          200,
          await tools.call(request.url!.split("/").at(-1) as never, await readJson(request)),
        );
      } catch (error) {
        sendError(response, error);
      }
    })();
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      resolve("packages/formwork/dist/stdio.js"),
      "--url",
      `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    ],
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
    expect(JSON.parse((read.content as any[])[0].text)).toMatchObject({
      completeness: "full",
      revision: "1",
    });
    const error = await client.callTool({
      name: "models.preview",
      arguments: { modelId: "orders", router: "missing" },
    });
    expect(error.isError).toBe(true);
    expect(JSON.parse((error.content as any[])[0].text).error.code).toBe("UNKNOWN_ROUTER");
  } finally {
    await client.close();
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
});
