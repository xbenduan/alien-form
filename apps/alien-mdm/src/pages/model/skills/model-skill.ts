import type { Runtime } from "@alien-form/engine";
import { assertBuilderSchema } from "@alien-form/validate";
import { transport } from "@runtime/transport";
import coreTypesSource from "../../../../../../packages/core/src/types.ts?raw";
import assertSource from "../../../../../../packages/validate/src/assert.ts?raw";
import builderSchemaSource from "../../../../../../packages/validate/src/builder-schema.ts?raw";
import fieldSchemaSource from "../../../../../../packages/validate/src/field-schema.ts?raw";
import validateIndexSource from "../../../../../../packages/validate/src/index.ts?raw";
import runtimeTypesSource from "../../../../../../packages/validate/src/runtime-types.ts?raw";
import pageTemplatesSource from "../builder/page-templates.ts?raw";
import { createDefaultPages, PAGE_TEMPLATES } from "../builder/page-templates";
import modelScriptSource from "./skill-assets/model.mjs?raw";

const SKILL_NAME = "alien-form-model";

function stringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function modelTemplate() {
  const name = "example_model";
  const title = "示例模型";
  return {
    meta: {
      name,
      title,
      group: "other",
      singularLabel: title,
      pluralLabel: title,
      defaultPageSize: 20,
    },
    fields: [
      {
        key: "name",
        title: "名称",
        type: "text",
        nullable: false,
        index: true,
        filterable: true,
      },
      {
        key: "id",
        title: "ID",
        type: "text",
        system: true,
        nullable: false,
        unique: true,
        index: true,
        filterable: true,
      },
      {
        key: "createdAt",
        title: "创建时间",
        type: "integer",
        valueType: "string",
        system: true,
        filterable: true,
      },
      {
        key: "updatedAt",
        title: "更新时间",
        type: "integer",
        valueType: "string",
        system: true,
        filterable: true,
      },
    ],
    definitions: {
      "form-schema": {
        type: "object",
        properties: {
          name: {
            type: "string",
            title: "名称",
            component: "Input",
            required: true,
          },
          id: { type: "string", title: "ID", display: "hidden", required: true },
          createdAt: {
            type: "string",
            title: "创建时间",
            component: "Input",
            props: { readOnly: true },
          },
          updatedAt: {
            type: "string",
            title: "更新时间",
            component: "Input",
            props: { readOnly: true },
          },
        },
      },
    },
    pages: createDefaultPages(name, title),
  };
}

function componentManifest(runtime: Runtime) {
  return {
    generatedAt: new Date().toISOString(),
    source: "当前页面 Runtime 注册表",
    components: runtime
      .componentCodes()
      .sort((left, right) => left.localeCompare(right))
      .map((code) => {
        const registration = runtime.resolveComponent(code);
        return {
          code,
          adapter: registration?.adapter ?? null,
          meta: registration?.meta ?? null,
        };
      }),
  };
}

function describeUtility(value: unknown, seen = new WeakSet<object>()): Record<string, unknown> {
  if (typeof value === "function") {
    return {
      type: "function",
      name: value.name || null,
      parameterCount: value.length,
      source: Function.prototype.toString.call(value),
    };
  }
  if (!value || typeof value !== "object") return { type: typeof value, value };
  if (seen.has(value)) return { type: "circular-reference" };
  seen.add(value);
  return {
    type: Array.isArray(value) ? "array" : "object",
    members: Object.fromEntries(
      Object.entries(value).map(([key, member]) => [key, describeUtility(member, seen)]),
    ),
  };
}

function utilityManifest(runtime: Runtime) {
  return {
    generatedAt: new Date().toISOString(),
    source: "当前页面 Runtime 注册表",
    utilities: runtime
      .utilityEntries()
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, value]) => ({ code, ...describeUtility(value) })),
  };
}

function enumManifest(runtime: Runtime) {
  return {
    generatedAt: new Date().toISOString(),
    source: "当前页面 Runtime 注册表",
    enums: runtime
      .enumEntries()
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, value]) => ({ code, value })),
  };
}

function templateManifest() {
  return {
    generatedAt: new Date().toISOString(),
    templates: PAGE_TEMPLATES.map(({ key, label, description, build }) => ({
      key,
      label,
      description,
      example: build("example_model", "示例模型"),
    })),
  };
}

function connection() {
  const token = transport.token;
  const cookie = document.cookie || null;
  const baseUrl = window.location.origin;
  return {
    baseUrl,
    modelApi: {
      create: {
        method: "POST",
        path: "/api/schemas",
        url: new URL("/api/schemas", `${baseUrl}/`).href,
      },
      get: {
        method: "GET",
        pathTemplate: "/api/schemas/{name}",
        urlTemplate: new URL("/api/schemas/{name}", `${baseUrl}/`).href,
      },
      update: {
        method: "PUT",
        pathTemplate: "/api/schemas/{name}",
        urlTemplate: new URL("/api/schemas/{name}", `${baseUrl}/`).href,
      },
      contentType: "application/json",
    },
    authentication: {
      type: token ? "bearer" : cookie ? "cookie" : "none",
      bearerToken: token,
      cookie,
    },
    security:
      "此文件包含当前登录会话凭证。禁止提交到版本库、日志或聊天记录；会话失效后请重新下载 Skill。",
  };
}

function skillMarkdown(baseUrl: string): string {
  return `---
name: "${SKILL_NAME}"
description: "Builds, creates, and edits renderable Alien Form models. Invoke when generating, publishing, or updating a model schema."
---

# Alien Form 模型管理

本 Skill 面向下载时所在的服务 \`${baseUrl}\`。目标是生成严格符合当前项目协议、可被当前 Runtime 渲染的模型，并调用该服务新增或编辑模型。

## 强制流程

1. 读取 \`references/protocol/builder-schema.ts\`、\`field-schema.ts\` 和 \`core-types.ts\`，以协议为唯一真相源。
2. 读取 \`references/runtime-components.json\`，只能使用其中存在且 adapter 匹配场景的组件。
3. 读取 \`references/runtime-utils.json\` 与 \`runtime-enums.json\`，表达式只能调用其中登记的 \`$utils\` 方法和 \`$enums\` 值。
4. 读取 \`references/page-templates.json\`，优先吸收模板结构；按模型名替换示例中的 \`example_model\`。
5. 以 \`templates/model.json\` 为起点生成完整 JSON。存储字段只写入 \`fields\`；表现配置只写入 \`definitions["form-schema"]\`。
6. 保证每个落库字段在 form-schema properties 中有同名表现定义。不要添加协议外 fallback。
7. 创建前检查模型名和字段名约束、重复字段、required 与 nullable 的一致性。
8. 新增模型时，将最终 JSON 写入工作文件，然后运行 \`node scripts/model.mjs create <模型文件路径>\`。
9. 编辑模型时，先运行 \`node scripts/model.mjs get <模型名> > <工作文件路径>\` 获取当前完整模型；仅修改目标内容，再运行 \`node scripts/model.mjs update <模型名> <工作文件路径>\`。

模型接口固定在当前服务地址的 \`/api/schemas\` 下。常规服务与 Cloudflare 服务使用同一接口协议。完整服务地址和当前会话凭证只从 \`references/connection.json\` 读取，不要在回答、日志或生成的 Schema 中复述凭证。

编辑必须使用 \`PUT /api/schemas/:name\`，路径中的名称是模型标识；不要通过 POST 创建同名模型，也不要在更新失败时降级为新增。

## 组件约束

- \`adapter: "form"\`：用于 \`definitions["form-schema"]\` 的字段 component。
- \`adapter: "page"\`：用于 \`pages[].properties\` 的页面节点 component。
- \`adapter: "antd"\`：用于页面中的原子展示节点。
- 组件 meta.sample 是当前 Runtime 提供的最小合法示例。

## 输出要求

只提交可解析的 JSON 模型，不输出 TypeScript 函数。表达式必须保持 \`{{ ... }}\` 字符串形式。接口返回非 2xx 时停止，不得自动改用其他接口或认证方式。
`;
}

function apiMarkdown(baseUrl: string): string {
  const createUrl = new URL("/api/schemas", `${baseUrl}/`).href;
  const modelUrl = new URL("/api/schemas/{name}", `${baseUrl}/`).href;
  return `# 模型接口

- 新增：\`POST ${createUrl}\`
- 查询：\`GET ${modelUrl}\`
- 编辑：\`PUT ${modelUrl}\`
- 请求头：\`Accept: application/json\`、\`Content-Type: application/json\`
- 认证：优先 \`Authorization: Bearer <token>\`，没有 Token 时使用导出的 Cookie
- 新增与编辑的请求体：完整 \`BuilderSchema\` JSON
- 查询成功：HTTP 200，响应体为当前完整模型
- 新增成功：HTTP 201，响应体为创建后的模型
- 编辑成功：HTTP 200，响应体为更新后的模型；服务端以路径中的名称覆盖 \`meta.name\`
- 同名冲突：HTTP 409
- 模型不存在：HTTP 404
- 未认证或会话失效：HTTP 401，应停止并要求用户重新下载 Skill
- 协议或存储错误：HTTP 400，应依据响应错误修正模型

不要调用记录接口管理模型。编辑前必须查询当前模型，更新时提交完整模型，不要只提交局部字段。
`;
}

export async function downloadModelSkill(runtime: Runtime): Promise<void> {
  const { strToU8, zipSync } = await import("fflate");
  const template = modelTemplate();
  assertBuilderSchema(template);
  const currentConnection = connection();
  const files: Record<string, Uint8Array> = {};
  const add = (path: string, content: string) => {
    files[`${SKILL_NAME}/${path}`] = strToU8(content);
  };

  add("SKILL.md", skillMarkdown(currentConnection.baseUrl));
  add(".gitignore", "references/connection.json\n");
  add("references/api.md", apiMarkdown(currentConnection.baseUrl));
  add("references/connection.json", stringify(currentConnection));
  add("references/runtime-components.json", stringify(componentManifest(runtime)));
  add("references/runtime-utils.json", stringify(utilityManifest(runtime)));
  add("references/runtime-enums.json", stringify(enumManifest(runtime)));
  add("references/page-templates.json", stringify(templateManifest()));
  add("references/page-templates.ts", pageTemplatesSource);
  add("references/protocol/index.ts", validateIndexSource);
  add("references/protocol/assert.ts", assertSource);
  add("references/protocol/builder-schema.ts", builderSchemaSource);
  add("references/protocol/field-schema.ts", fieldSchemaSource);
  add("references/protocol/runtime-types.ts", runtimeTypesSource);
  add("references/protocol/core-types.ts", coreTypesSource);
  add("templates/model.json", stringify(template));
  add("scripts/model.mjs", modelScriptSource);

  const archive = zipSync(files, { level: 6 });
  const data = archive.buffer.slice(
    archive.byteOffset,
    archive.byteOffset + archive.byteLength,
  ) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([data], { type: "application/zip" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${SKILL_NAME}.zip`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
