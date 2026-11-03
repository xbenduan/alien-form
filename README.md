# ALIEN CMS

ALIEN 使用一份字段 Schema 驱动服务端校验、D1 存储和查询，以及前端 form、filter、table、detail。核心框架 Formwork 提供 headless 数据与交互能力；应用提供组件、布局和原生嵌套 CSS。

```tsx
import { defineFormwork, Formwork } from "formwork";
import { apis } from "./formwork/api";
import { components } from "./formwork/components";
import { ui } from "./formwork/ui";
import { domains } from "./domains";
import { pages } from "./pages";

const app = defineFormwork({ apis, components, ui, domains, pages });
// 在 Solid 的 render 中挂载：
<Formwork app={app} class="root-formwork" />;
```

`domains` 与 `pages` 必须显式提供。`domains/list` 组合 `formwork/atom` 的 Records、Detail、Editor，提供默认记录管理；`domains/tree` 和 `domains/videos` 只演示布局组合。普通 Page 与 Domain 并列注册，模型的 `schema.domain` 仅表示业务分类。

## 本地启动

使用 Node **26.13.0**、pnpm **12.16.1**：

```sh
pnpm install --frozen-lockfile --registry=https://registry.npmjs.org
pnpm dev
```

启动器构建共享包、初始化本地 Worker/D1，并输出实际地址及私有账号文件路径。默认端口为 `5173` / `8788`，占用时自动选择可用端口；显式设置 `FORMWORK_CLIENT_PORT` / `FORMWORK_SERVICE_PORT` 时严格使用指定端口。

普通 `pnpm dev` 和 `pnpm dev:service` 保留本地数据与账号。需要从空库重新开始时执行 **`pnpm dev:reset`**，它会清空本地开发数据并生成新凭证。账号文件权限为 0600。唯一正式后端位于 `apps/service`，开发和生产都使用 D1。

当前记录协议使用部署目录下的 `state-records-v1` 保存本地数据。重构前的 `state` 目录保留原样，不自动读取或转换；新版空库沿用同目录 `bootstrap.json` 中的账号密码初始化。启动日志会输出实际数据路径，`dev:reset` 只重置当前协议目录。

## 创建模型并使用默认列表

在模型管理页新建同 ID 模型，粘贴定义、校验、保存草稿，再手动发布：

```json
{
  "schemaVersion": 1,
  "id": "articles",
  "title": "文章",
  "domain": "cms",
  "data": {
    "title": { "type": "string", "required": true, "props": { "placeholder": "输入标题" } },
    "body": { "type": "string", "format": "richtext" },
    "tags": { "type": "array", "format": "strings", "enum": ["产品", "研发"] }
  }
}
```

发布后打开 `/list/articles`。列表支持查询、排序、分页、新建、详情、编辑、删除确认和未保存提示。记录更新与删除同时检查模型版本和记录版本；冲突时保留编辑输入。`richtext` 示例以普通字符串存储，用多行输入编辑。

| 地址                                                     | 用途                             |
| -------------------------------------------------------- | -------------------------------- |
| `/models?modelId=articles`                               | 模型草稿、校验、预览、发布和版本 |
| `/list/articles`                                         | 默认记录管理                     |
| `/list/articles/create`                                  | 新建记录                         |
| `/list/articles/edit/recordId`                           | 编辑指定记录                     |
| `/list/articles/detail/recordId`                         | 查看指定记录                     |
| `/model-preview?modelId=articles&router=list&revision=…` | 审阅指定草稿 revision            |

从列表打开操作可使用 modal 或 drawer；直接访问或刷新操作地址使用 page presenter。模型预览复用正式 Domain 与组件，记录存在独立内存中。管理页中的嵌入预览能接收尚未保存的有效 Schema。

更多模型示例：

- [订单](examples/orders.definition.json)：枚举、多选和明细数组。
- [内容管理](examples/cms.definition.json)：共享字符串格式契约。
- [组织架构](examples/departments.definition.json)：自引用；tree-list 只按当前查询页分组。
- [客户档案](examples/customer-profile.definition.json)：嵌套对象和本地引用。
- [独立 headless 接入](examples/headless/README.md)：独立内存 API 和另一套 UI，不导入 CMS 或 Worker。

## HTTP 与 MCP

HTTP API 基址为 `/api/v1`。`createFormworkApi` 从 `formwork/model` 导出；`FormworkApis` 和无 DOM 的 `createDataClient` 从 `formwork/data` 导出。分离部署可设置 `VITE_FORMWORK_API_URL=https://<worker>/api/v1`。

MCP 使用 Streamable HTTP，端点为 `<Worker origin>/mcp`。在管理页签发 agent token 后配置：

```json
{
  "mcpServers": {
    "formwork": {
      "url": "https://<worker>/mcp",
      "headers": { "Authorization": "Bearer <agent token>" }
    }
  }
}
```

| 工具                          | 用途                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| `formwork.describe`           | 指南、definition JSON Schema、模板及当前权限                    |
| `formwork.capabilities`       | 按 `{modelId,router}` 查看 app 组件、格式、UI 和 transform 声明 |
| `models.list` / `models.read` | 读取可管理模型、定义和管理 revision                             |
| `models.validate`             | 返回 errors 与仍需运行时完成的 runtimeChecks                    |
| `models.write`                | 保存草稿；新建 `ifRevision:null`，修改使用当前 revision         |
| `models.preview`              | 生成已登记 Domain 的草稿预览链接                                |

常用流程为 `describe → capabilities → validate → write → preview`，发布在管理页手动完成。Resources 为 `formwork://guide`、`formwork://capabilities`、`formwork://definition-schema`。

## 验证和部署

```sh
pnpm exec playwright install chromium
pnpm check
pnpm worker:dry-run
```

构建顺序为 formwork → vite-plugin → client → service。`pnpm check` 包含 lint、格式、构建、类型、Vitest 和 Playwright；E2E 使用隔离数据库。`worker:dry-run` 只打包。

部署前配置 `apps/service/wrangler.json` 的 D1 绑定和 `FORMWORK_CLIENT_ORIGIN`。新库需要 secrets：`FORMWORK_BOOTSTRAP_ADMIN_USERNAME`、`FORMWORK_BOOTSTRAP_ADMIN_PASSWORD`、`FORMWORK_CAPABILITY_TOKEN`。部署脚本支持从同名环境变量写入 secrets。

```sh
pnpm --filter @alien-form/service exec wrangler login
pnpm deploy
# 可选：登记前端能力以支持 MCP 发现和路由预览
pnpm capabilities:register --api-url https://<worker>/api/v1 --client-origin https://<worker>
```

`deploy` 将客户端静态资源与 API 发布到同一个 Worker，并初始化 metadata、同步系统模型。此次重构按未部署项目处理，只支持当前协议，不提供历史数据迁移工具。后续模型发布仍检查已有记录、字段身份及关系一致性。

能力登记命令需要 deploy token 环境变量 `FORMWORK_CAPABILITY_TOKEN`，默认直接分析当前应用入口；也可通过 `--file` 读取构建产物。CMS 无需启用 Formwork Vite 插件即可运行和登记能力；没有能力清单也能校验、保存和发布模型。

## 文档与代码入口

| 入口                                              | 内容                                               |
| ------------------------------------------------- | -------------------------------------------------- |
| [字段协议](docs/schema-design.md)                 | type / format、props、enum、relation、查询与值语义 |
| [运行时 API](docs/formwork-api-architecture.md)   | 注册、atom、controller、HTTP 协议与生命周期        |
| [重构设计](docs/formwork-redesign-exploration.md) | 最终用法、职责和取舍                               |
| [验收记录](docs/formwork-redesign-review.md)      | 已实现范围与验证证据                               |
| [项目介绍](docs/project-introduction.md)          | 产品定位与适用边界                                 |
| `scripts/dev.mjs` / `scripts/e2e-server.ts`       | 开发和隔离测试编排                                 |
| `apps/service/script/initialize.ts`               | 数据库初始化与系统模型同步                         |
