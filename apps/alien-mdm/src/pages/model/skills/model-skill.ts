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
    createModel: {
      method: "POST",
      path: "/api/schemas",
      url: new URL("/api/schemas", `${baseUrl}/`).href,
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
description: "Builds and creates renderable Alien Form models on the current service. Invoke when generating or publishing a model schema."
---

# Alien Form 模型生成

本 Skill 面向下载时所在的服务 \`${baseUrl}\`。目标是生成严格符合当前项目协议、可被当前 Runtime 渲染的模型，并调用该服务创建模型。

## 强制流程

1. 读取 \`references/protocol/builder-schema.ts\`、\`field-schema.ts\` 和 \`core-types.ts\`，以协议为唯一真相源。
2. 读取 \`references/runtime-components.json\`，只能使用其中存在且 adapter 匹配场景的组件。
3. 读取 \`references/page-templates.json\`，优先吸收模板结构；按模型名替换示例中的 \`example_model\`。
4. 以 \`templates/model.json\` 为起点生成完整 JSON。存储字段只写入 \`fields\`；表现配置只写入 \`definitions["form-schema"]\`。
5. 保证每个落库字段在 form-schema properties 中有同名表现定义。不要添加协议外 fallback。
6. 创建前检查模型名和字段名约束、重复字段、required 与 nullable 的一致性。
7. 将最终 JSON 写入工作文件，然后运行 \`node scripts/create-model.mjs <模型文件路径>\`。

创建接口固定为当前服务地址下的 \`POST /api/schemas\`。常规服务与 Cloudflare 服务使用同一接口协议。完整接口地址和当前会话凭证只从 \`references/connection.json\` 读取，不要在回答、日志或生成的 Schema 中复述凭证。

## 组件约束

- \`adapter: "form"\`：用于 \`definitions["form-schema"]\` 的字段 component。
- \`adapter: "page"\`：用于 \`pages[].properties\` 的页面节点 component。
- \`adapter: "antd"\`：用于页面中的原子展示节点。
- 组件 meta.sample 是当前 Runtime 提供的最小合法示例。

## 输出要求

只提交可解析的 JSON 模型，不输出 TypeScript 函数。表达式必须保持 \`{{ ... }}\` 字符串形式。接口返回非 2xx 时停止，不得自动改用其他接口或认证方式。
`;
}

function apiMarkdown(endpoint: string): string {
  return `# 创建模型接口

- 完整地址：\`${endpoint}\`
- 方法：\`POST\`
- 路径：\`/api/schemas\`
- 请求头：\`Accept: application/json\`、\`Content-Type: application/json\`
- 认证：优先 \`Authorization: Bearer <token>\`，没有 Token 时使用导出的 Cookie
- 请求体：完整 \`BuilderSchema\` JSON
- 成功：HTTP 201，响应体为创建后的模型
- 同名冲突：HTTP 409
- 未认证或会话失效：HTTP 401，应停止并要求用户重新下载 Skill
- 协议或存储错误：HTTP 400，应依据响应错误修正模型

不要调用记录接口来创建模型，也不要把模型拆成多次请求。
`;
}

const CREATE_MODEL_SCRIPT = `import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const connection = JSON.parse(
  await readFile(resolve(skillRoot, "references/connection.json"), "utf8"),
);
const modelPath = process.argv[2];
if (!modelPath) {
  throw new Error("用法: node scripts/create-model.mjs <模型 JSON 文件>");
}

const model = JSON.parse(await readFile(resolve(process.cwd(), modelPath), "utf8"));
const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
};
if (connection.authentication.bearerToken) {
  headers.Authorization = \`Bearer \${connection.authentication.bearerToken}\`;
} else if (connection.authentication.cookie) {
  headers.Cookie = connection.authentication.cookie;
} else {
  throw new Error("Skill 中没有可用登录凭证，请重新登录并下载");
}

const response = await fetch(connection.createModel.url, {
  method: connection.createModel.method,
  headers,
  body: JSON.stringify(model),
});
const body = await response.text();
if (!response.ok) {
  throw new Error(\`创建模型失败 (\${response.status}): \${body}\`);
}
process.stdout.write(\`\${body}\\n\`);
`;

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
  add("references/api.md", apiMarkdown(currentConnection.createModel.url));
  add("references/connection.json", stringify(currentConnection));
  add("references/runtime-components.json", stringify(componentManifest(runtime)));
  add("references/page-templates.json", stringify(templateManifest()));
  add("references/page-templates.ts", pageTemplatesSource);
  add("references/protocol/index.ts", validateIndexSource);
  add("references/protocol/assert.ts", assertSource);
  add("references/protocol/builder-schema.ts", builderSchemaSource);
  add("references/protocol/field-schema.ts", fieldSchemaSource);
  add("references/protocol/runtime-types.ts", runtimeTypesSource);
  add("references/protocol/core-types.ts", coreTypesSource);
  add("templates/model.json", stringify(template));
  add("scripts/create-model.mjs", CREATE_MODEL_SCRIPT);

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
