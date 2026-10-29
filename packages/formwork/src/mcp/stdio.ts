#!/usr/bin/env node
/// <reference types="node" />
import process from "node:process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { errorPayload } from "../model/errors";
import { createToolClient } from "./client";
import { toolDescriptions, toolInputSchemas } from "./tools";
import type { ModelToolName } from "./tools";

try {
  const index = process.argv.indexOf("--url");
  if (index < 0 || !process.argv[index + 1])
    throw new Error("用法: FORMWORK_API_TOKEN=<token> formwork-mcp --url http://127.0.0.1:8787");
  if (!process.env.FORMWORK_API_TOKEN) throw new Error("缺少 FORMWORK_API_TOKEN");
  const client = createToolClient(process.argv[index + 1]!, {
    token: () => process.env.FORMWORK_API_TOKEN,
  });
  await client.call("models.list", {}, AbortSignal.timeout(10_000));
  const server = new McpServer({ name: "formwork", version: "0.1.0" });
  for (const name of Object.keys(toolInputSchemas) as ModelToolName[]) {
    server.registerTool(
      name,
      { description: toolDescriptions[name], inputSchema: toolInputSchemas[name] },
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
