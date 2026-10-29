#!/usr/bin/env node
/// <reference types="node" />
import process from "node:process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { errorPayload } from "../model/errors";
import { createToolClient } from "./client";
import { toolInputSchemas } from "./tools";
import type { ModelToolName } from "./tools";

const descriptions: Record<ModelToolName, string> = {
  "models.list": "列出当前项目的完整模型目录",
  "models.read": "读取完整模型与不透明 revision",
  "formwork.capabilities": "读取路由的有效组件、fn、源码声明与 JSDoc",
  "models.validate": "校验模型原文并列出运行时检查",
  "models.write": "校验后按 ifRevision 条件写入完整原文",
  "models.preview": "返回实际工作台预览 URL，必填记录参数不可省略",
};
try {
  const index = process.argv.indexOf("--url");
  if (index < 0 || !process.argv[index + 1])
    throw new Error("用法: formwork-mcp --url http://127.0.0.1:5173");
  const client = createToolClient(process.argv[index + 1]!);
  await client.call("models.list", {}, AbortSignal.timeout(10_000));
  const server = new McpServer({ name: "formwork", version: "0.1.0" });
  for (const name of Object.keys(toolInputSchemas) as ModelToolName[]) {
    server.registerTool(
      name,
      { description: descriptions[name], inputSchema: toolInputSchemas[name] },
      async (input: unknown, extra: { signal: AbortSignal }) => {
        try {
          const result = await client.call(name, input, extra.signal);
          return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
        } catch (error) {
          return {
            isError: true,
            content: [
              { type: "text" as const, text: JSON.stringify({ error: errorPayload(error) }) },
            ],
          };
        }
      },
    );
  }
  await server.connect(new StdioServerTransport());
} catch (error) {
  console.error(JSON.stringify({ error: errorPayload(error) }));
  process.exitCode = 1;
}
