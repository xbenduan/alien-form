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
            component: "DatePicker",
            props: { readOnly: true, showTime: true },
          },
          updatedAt: {
            type: "string",
            title: "更新时间",
            component: "DatePicker",
            props: { readOnly: true, showTime: true },
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
      },
      get: {
        method: "GET",
        pathTemplate: "/api/schemas/{name}",
      },
      update: {
        method: "PUT",
        pathTemplate: "/api/schemas/{name}",
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

## 项目说明

Alien Form 是一个 Schema 驱动的模型管理和页面渲染系统。一份 \`BuilderSchema\` 同时描述模型元信息、数据库字段、表单表现以及列表/新增/编辑/详情等页面。

模型提交到服务端后会被校验并持久化；前端 Engine 会编译其中的页面定义，Runtime 再注入当前可用的组件、Utils、枚举和服务，最终渲染为可操作的 CRUD 管理界面。因此，本 Skill 产出的 Schema 是可以直接发布和运行的完整业务模型，不只是静态表单配置。

## 强制流程

1. 读取 \`references/protocol/builder-schema.ts\`、\`field-schema.ts\` 和 \`core-types.ts\`，以协议为唯一真相源。
2. 读取 \`references/runtime-components.json\`，只能使用其中存在且 adapter 匹配场景的组件。
3. 读取 \`references/runtime-utils.json\` 与 \`runtime-enums.json\`。工具通过 \`$utils.code\` 访问，枚举通过 \`$enums.code\` 访问；服务保持 \`$service("code")(params)\` 形式。
4. 读取 \`references/page-templates.json\`，优先吸收模板结构；按模型名替换示例中的 \`example_model\`。
5. 以 \`templates/model.json\` 为起点生成完整 JSON。存储字段只写入 \`fields\`；表现配置只写入 \`definitions["form-schema"]\`。
6. 保证每个落库字段在 form-schema properties 中有同名表现定义。不要添加协议外 fallback。
7. 创建前检查模型名和字段名约束、重复字段、required 与 nullable 的一致性，以及所有关联字段的 RemoteSelect 协议。
8. 新增模型时，将最终 JSON 写入工作文件，然后运行 \`node scripts/model.mjs create <模型文件路径>\`。
9. 编辑模型时，先运行 \`node scripts/model.mjs get <模型名> > <工作文件路径>\` 获取当前完整模型；仅修改目标内容，再运行 \`node scripts/model.mjs update <模型名> <工作文件路径>\`。

模型接口固定在当前服务地址的 \`/api/schemas\` 下。常规服务与 Cloudflare 服务使用同一接口协议。完整服务地址和当前会话凭证只从 \`references/connection.json\` 读取，不要在回答、日志或生成的 Schema 中复述凭证。

编辑必须使用 \`PUT /api/schemas/:name\`，路径中的名称是模型标识；不要通过 POST 创建同名模型，也不要在更新失败时降级为新增。

## 组件约束

- \`adapter: "form"\`：用于 \`definitions["form-schema"]\` 的字段 component。
- \`adapter: "page"\`：用于 \`pages[].properties\` 的页面节点 component。
- \`adapter: "antd"\`：用于页面中的原子展示节点。
- 组件 meta.sample 是当前 Runtime 提供的最小合法示例。

## 关联字段协议

\`fields[].relation\` 是关联字段的唯一真相源。配置 relation 后，必须为同名
\`definitions["form-schema"].properties.<field>\` 写入 \`RemoteSelect\`：

\`\`\`json
{
  "type": "string",
  "component": "RemoteSelect",
  "props": {
    "model": "目标模型名",
    "loadOptions": "{{ $utils.relation($service(\\"records.list\\")) }}",
    "valueField": "id",
    "labelField": "name",
    "pageSize": 10
  }
}
\`\`\`

- \`props.model\` 必须与 \`fields[].relation.target\` 完全一致。
- \`props.valueField\` 必须与 \`fields[].relation.valueField\` 完全一致；未声明时固定为 \`"id"\`。
- \`props.labelField\` 必须与 \`fields[].relation.labelField\` 完全一致；未声明时固定为 \`"name"\`。
- \`loadOptions\` 只允许使用上面的 \`$utils + $service\` 标准表达式；模型、\`valueField\`、\`labelField\`、\`pageSize\` 等配置必须写在组件 \`props\`，不得写入表达式。不要为 RemoteSelect 配置 \`dataSource\`；组件会在用户首次展开时加载前 \`pageSize\` 条，在输入搜索词后自动传递 \`keyword/searchFields\`。
- \`many-to-many\` 关联额外设置 \`props.multiple: true\`，并将 storage 字段配置为 \`type: "json"\`、\`valueType: "array"\`。

服务端会严格校验关联字段。若收到 HTTP 400，读取完整错误中的字段路径、期望值和实际值，直接修正该模型 JSON 后重新提交；不要移除 relation 或改用非协议字段绕过校验。

## 自关联树协议

\`tree\` 是单模型自关联树组件。数据加载必须通过 \`records.subtree\`，由组件 props 描述模型与字段映射：

\`\`\`json
{
  "type": "string",
  "component": "tree",
  "props": {
    "model": "example_model",
    "valueField": "id",
    "parentField": "parentId",
    "labelField": "name",
    "showRoot": false,
    "loadData": "{{ $utils.tree($service(\\"records.subtree\\")) }}"
  }
}
\`\`\`

- \`tree\` 只支持单模型自关联；不得配置额外模型、用户聚合或内联数据转换。
- \`loadData\` 只允许使用上面的 \`$utils + $service\` 标准表达式；模型和字段映射必须声明在组件 \`props\`。
- \`valueField\` 是节点值字段，\`parentField\` 是父节点字段，\`labelField\` 是显示字段。
- \`showRoot\` 默认为 \`false\`：仅一个根节点时隐藏根节点并展示其子节点；多个根节点时始终展示根节点。
- 后端 \`records.subtree\` 返回平铺节点；\`$utils.tree\` 负责将它们组装成嵌套节点。
- 树驱动表格时，在 table props 中配置 \`"parentId": "{{ $values.tree }}"\`。后端 \`records.list\` 会返回该节点自身及全部后代；不要把树值写进 \`filter\`，因为 \`parentId\` 单独表达递归范围。

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
