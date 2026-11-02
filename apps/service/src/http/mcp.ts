import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { checkAbort, errorPayload, FormworkError } from "formwork/model";
import {
  definitionJsonSchema,
  mcpInstructions,
  toolDescriptions,
  toolInputSchemas,
} from "formwork/mcp";
import type { ModelToolName } from "formwork/mcp";
import type { Actor, Env } from "../contracts";
import { ModelService } from "../application/model-service";

async function callTool(service: ModelService, name: ModelToolName, input: unknown) {
  switch (name) {
    case "formwork.describe": {
      const args = toolInputSchemas[name].parse(input);
      return service.describe(args.modelId);
    }
    case "models.list":
      toolInputSchemas[name].parse(input);
      return service.list();
    case "models.read": {
      const args = toolInputSchemas[name].parse(input);
      return service.read(args.modelId);
    }
    case "formwork.capabilities": {
      const args = toolInputSchemas[name].parse(input);
      if (args.modelId === undefined || args.router === undefined) return service.catalog();
      return service.capabilities(
        args.modelId,
        { router: args.router, window: args.window },
        args.domain,
      );
    }
    case "models.validate": {
      const args = toolInputSchemas[name].parse(input);
      return service.validate(
        args.modelId,
        args.definition,
        args.router === undefined ? undefined : { router: args.router, window: args.window },
      );
    }
    case "models.write": {
      const args = toolInputSchemas[name].parse(input);
      return service.save(args.modelId, args.definition, args.ifRevision);
    }
    case "models.preview": {
      const args = toolInputSchemas[name].parse(input);
      return service.preview(
        args.modelId,
        { router: args.router, window: args.window },
        args.params ?? {},
      );
    }
  }
}

/**
 * 用当前请求的可信身份处理无状态 Streamable HTTP MCP 调用。
 * @param actor 已由 authenticate 和 requireBusiness 校验的当前请求身份。
 */
export async function handleMcp(request: Request, env: Env, actor: Actor): Promise<Response> {
  // 工具和资源均为请求/响应操作，不提供独立 SSE 通知流或持久 MCP session。
  if (request.method !== "POST")
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const service = new ModelService(env.DB, actor);
  const server = new McpServer(
    { name: "formwork", version: "0.1.0" },
    { instructions: mcpInstructions },
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: 2 * 1024 * 1024,
  });
  for (const name of Object.keys(toolInputSchemas) as ModelToolName[]) {
    server.registerTool(
      name,
      {
        description: toolDescriptions[name],
        inputSchema: toolInputSchemas[name],
        annotations: {
          readOnlyHint: name !== "models.write",
          destructiveHint: name === "models.write",
          openWorldHint: false,
        },
      },
      async (input: unknown, extra: { signal: AbortSignal }) => {
        try {
          checkAbort(extra.signal);
          const result = await callTool(service, name, input);
          return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
        } catch (error) {
          if (!(error instanceof FormworkError)) console.error("MCP tool failed", name, error);
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: errorPayload(
                    error instanceof FormworkError
                      ? error
                      : new FormworkError("INTERNAL_ERROR", "服务处理请求失败"),
                  ),
                }),
              },
            ],
          };
        }
      },
    );
  }
  const resources = [
    {
      name: "model-authoring-guide",
      uri: "formwork://guide",
      description: "独立 agent 的模型构建指南、模板、权限和工作流",
      read: () => service.describe(),
    },
    {
      name: "application-capabilities",
      uri: "formwork://capabilities",
      description: "当前应用全部已登记的分层组件、fn、声明、JSDoc 与路由参数",
      read: () => service.catalog(),
    },
    {
      name: "model-definition-schema",
      uri: "formwork://definition-schema",
      description: "完整 {document,backend} 的 JSON Schema；语义约束另用 models.validate",
      read: () => definitionJsonSchema,
    },
  ];
  for (const resource of resources) {
    server.registerResource(
      resource.name,
      resource.uri,
      { description: resource.description, mimeType: "application/json" },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(await resource.read()),
          },
        ],
      }),
    );
  }
  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally {
    // JSON 响应已经生成，可在返回前释放当前请求的 transport。
    await server.close();
  }
}
