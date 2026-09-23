import { readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "oxfmt";
import { zodToJsonSchema } from "zod-to-json-schema";
import { loadRuntimeCapabilities } from "../apps/alien-mdm/scripts/load-runtime-capabilities.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(
  root,
  "apps/alien-mdm/src/pages/model/skills/generated/alien-form-model",
);
const capabilityOutput = resolve(root, "packages/protocol/src/generated-capabilities.ts");
const check = process.argv.includes("--check");

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function skillMarkdown(): string {
  return `---
name: "alien-form-model"
description: "Builds, creates, and edits renderable Alien Form models."
---

# Alien Form 模型管理

本 Skill 面向下载时所在的服务 \`__ALIEN_FORM_BASE_URL__\`。模型协议、Runtime 能力、页面模版和 JSON Schema 均由项目协议源码自动生成。

## 强制流程

1. 先读取 \`references/model-schema.json\`，它是可提交模型的机器可读协议。
2. 再读取 \`references/runtime-components.json\`、\`runtime-services.json\`、\`runtime-utils.json\` 和 \`runtime-enums.json\`，只引用其中声明的能力。
3. 读取 \`references/page-templates.json\` 作为初始 AST。模版仅在创建时展开，之后可以自由增删页面节点、slot、属性和表达式。
4. 以 \`templates/model.json\` 为起点。每个字段的存储配置与表单表现统一放在 \`fields[]\` 中。
5. 页面节点通过显式 \`slots\` 引用同级 \`properties\` 子节点，不要在 props 中隐式传递节点 key。
6. 页面动作也是 AST 节点：记录跳转使用 \`record-action\`，自定义行操作使用 \`row-button\`，批量操作使用 \`batch-button\`。
7. \`{{ ... }}\` 表达式可以返回值、函数或异步函数；服务使用 \`$service("code")\`，工具和枚举分别使用 \`$utils.code\`、\`$enums.code\`。
8. 新增使用 \`node scripts/model.mjs create <模型文件路径>\`，服务端会执行完整协议校验。
9. 编辑时先执行 \`node scripts/model.mjs get <模型名> > <模型文件路径>\`，再执行 \`node scripts/model.mjs update <模型名> <模型文件路径>\`。

## 系统字段

\`id\`、\`createdAt\`、\`updatedAt\` 必须保持模板配置：仅详情模式显示、始终只读，并且只进入详情页“系统信息”分组。

## 自由度与边界

- AST 是最终页面协议，模版不是运行时限制。
- 可以删除内置页面或动作，也可以增加启停、导入、导出及业务专属节点。
- 页面特有的短逻辑可直接写入表达式；跨页面复用或涉及事务的逻辑应注册为 Runtime Service。
- 不允许引用能力清单之外的 component、service、utility 或 enum。
- 接口返回非 2xx 时停止，不得自动切换接口或认证方式。

## 接口

连接地址与当前会话凭证只从 \`references/connection.json\` 读取。编辑必须使用
\`PUT /api/v1/models/:name\`，不得通过 POST 创建同名模型。
`;
}

function apiMarkdown(): string {
  return `# 模型接口

- 服务地址：\`__ALIEN_FORM_BASE_URL__\`
- 新增：\`POST /api/v1/models\`
- 查询：\`GET /api/v1/models/{name}\`
- 编辑：\`PUT /api/v1/models/{name}\`
- 请求头：\`Accept: application/json\`、\`Content-Type: application/json\`
- 认证信息：读取 \`references/connection.json\`
- 新增与编辑请求体：完整 \`AlienSchema\`
- 协议或存储错误：HTTP 400，应根据响应中的精确路径修正模型
- 未认证：HTTP 401，应停止并要求重新下载 Skill
- 模型不存在：HTTP 404
- 同名冲突：HTTP 409
`;
}

async function source(path: string): Promise<string> {
  return readFile(resolve(root, path), "utf8");
}

interface Capabilities {
  components: unknown[];
  services: unknown[];
  utilities: unknown[];
  enums: unknown[];
}

async function capabilitySource(capabilities: Capabilities): Promise<string> {
  const source = `/**
 * Generated from the executable Runtime registry.
 * Run \`pnpm generate:model-artifacts\` after changing global registrations.
 */
import type { ComponentCapability, EnumCapability, RuntimeCapability } from "./capabilities.ts";

export const COMPONENT_CAPABILITIES: readonly ComponentCapability[] = ${JSON.stringify(capabilities.components, null, 2)};
export const SERVICE_CAPABILITIES: readonly RuntimeCapability[] = ${JSON.stringify(capabilities.services, null, 2)};
export const UTILITY_CAPABILITIES: readonly RuntimeCapability[] = ${JSON.stringify(capabilities.utilities, null, 2)};
export const ENUM_CAPABILITIES: readonly EnumCapability[] = ${JSON.stringify(capabilities.enums, null, 2)};
`;
  const result = await format(capabilityOutput, source);
  if (result.errors.length > 0) {
    throw new Error(
      `Runtime 能力清单格式化失败：${result.errors.map(({ message }) => message).join("; ")}`,
    );
  }
  return result.code;
}

async function syncCapabilityManifest(capabilities: Capabilities): Promise<void> {
  const expected = await capabilitySource(capabilities);
  if (check) {
    const actual = await readFile(capabilityOutput, "utf8").catch(() => undefined);
    if (actual !== expected) {
      throw new Error(
        "Runtime 能力清单已漂移：packages/protocol/src/generated-capabilities.ts。请运行 pnpm generate:model-artifacts",
      );
    }
    return;
  }
  await writeFile(capabilityOutput, expected);
}

async function expectedFiles(
  capabilities: Capabilities,
  protocol: typeof import("../packages/protocol/src/index.ts"),
): Promise<Map<string, string>> {
  const { PAGE_TEMPLATES, createModelTemplate, alienSchema } = protocol;
  const model = createModelTemplate();
  const files = new Map<string, string>();
  files.set("SKILL.md", skillMarkdown());
  files.set(".gitignore", "references/connection.json\n");
  files.set("references/api.md", apiMarkdown());
  files.set(
    "references/runtime-components.json",
    json({
      source: "Runtime.getCapabilities()",
      components: capabilities.components,
    }),
  );
  files.set(
    "references/runtime-services.json",
    json({ source: "Runtime.getCapabilities()", services: capabilities.services }),
  );
  files.set(
    "references/runtime-utils.json",
    json({ source: "Runtime.getCapabilities()", utilities: capabilities.utilities }),
  );
  files.set(
    "references/runtime-enums.json",
    json({ source: "Runtime.getCapabilities()", enums: capabilities.enums }),
  );
  files.set(
    "references/page-templates.json",
    json({
      source: "packages/protocol/src/page-templates.ts",
      templates: PAGE_TEMPLATES.map(({ key, label, description, build }) => ({
        key,
        label,
        description,
        example: build("example_model", "示例模型"),
      })),
    }),
  );
  files.set(
    "references/model-schema.json",
    json(
      zodToJsonSchema(alienSchema, {
        name: "AlienSchema",
        target: "jsonSchema7",
      }),
    ),
  );
  files.set("references/protocol/index.ts.txt", await source("packages/protocol/src/index.ts"));
  files.set("references/protocol/assert.ts.txt", await source("packages/protocol/src/assert.ts"));
  files.set(
    "references/protocol/capabilities.ts.txt",
    await source("packages/protocol/src/capabilities.ts"),
  );
  files.set(
    "references/protocol/generated-capabilities.ts.txt",
    await source("packages/protocol/src/generated-capabilities.ts"),
  );
  files.set(
    "references/protocol/alien-schema.ts.txt",
    await source("packages/protocol/src/alien-schema.ts"),
  );
  files.set(
    "references/protocol/page-templates.ts.txt",
    await source("packages/protocol/src/page-templates.ts"),
  );
  files.set(
    "references/protocol/model-template.ts.txt",
    await source("packages/protocol/src/model-template.ts"),
  );
  files.set(
    "references/protocol/form-types.ts.txt",
    await source("packages/protocol/src/form-types.ts"),
  );
  files.set(
    "references/protocol/runtime-types.ts.txt",
    await source("packages/protocol/src/runtime-types.ts"),
  );
  files.set("templates/model.json", json(model));
  files.set(
    "scripts/model.mjs",
    await source("apps/alien-mdm/src/pages/model/skills/skill-assets/model.mjs"),
  );
  return files;
}

async function listFiles(path: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      files.push(...(await listFiles(resolve(path, entry.name), relativePath)));
    else files.push(relativePath);
  }
  return files.sort();
}

async function checkFiles(files: Map<string, string>): Promise<void> {
  const actualPaths = await listFiles(outputRoot);
  const expectedPaths = [...files.keys()].sort();
  const errors: string[] = [];
  for (const path of expectedPaths) {
    const actual = await readFile(resolve(outputRoot, path), "utf8").catch(() => undefined);
    if (actual !== files.get(path)) errors.push(path);
  }
  for (const path of actualPaths) {
    if (!files.has(path)) errors.push(path);
  }
  if (errors.length > 0) {
    throw new Error(`生成产物已漂移：${errors.join(", ")}。请运行 pnpm generate:model-artifacts`);
  }
}

async function writeFiles(files: Map<string, string>): Promise<void> {
  await rm(outputRoot, { recursive: true, force: true });
  for (const [path, content] of files) {
    const target = resolve(outputRoot, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

async function main(): Promise<void> {
  const capabilities = (await loadRuntimeCapabilities(root)) as Capabilities;
  await syncCapabilityManifest(capabilities);
  const protocol = await import("../packages/protocol/src/index.ts");
  const files = await expectedFiles(capabilities, protocol);
  if (check) await checkFiles(files);
  else await writeFiles(files);

  console.log(
    check
      ? `Generated artifacts are current (${files.size} files)`
      : `Generated ${files.size} files in ${relative(root, outputRoot)}`,
  );
}

void main();
