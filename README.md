# ALIEN CMS

一份字段 Schema 同时驱动服务端校验、存储和查询，以及前端 form、filter、table、detail。保留 Framework → Domain → Page → Window 四层架构，页面和窗口在代码中组织布局。

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

字段级 `props` 由各场景组件按需使用。显式 `format` 优先，省略时根据 type、enum、relation 推导；`ui[scene].component` 保留局部覆盖。数组多选以真实数组保存，表格以标签展示；对象和结构化数组提供详情弹窗。Schema 不包含 views、pages 或布局节点。

## 本地启动

使用 Node **26.13.0**、pnpm **12.16.1**：

```sh
pnpm install --frozen-lockfile --registry=https://registry.npmjs.org
pnpm dev
```

启动器输出实际 Client/Worker URL 和私有账号文件路径。默认端口为 `5173` / `8788`，占用时自动选择可用端口。**每次 `pnpm dev`、`pnpm dev:local` 或 `pnpm dev:service` 都会清空本地开发 D1**，重新创建系统模型、管理员和凭证。账号文件位于用户目录，权限为 0600。

唯一后端是 `apps/service` 的 Cloudflare Worker，开发和生产都使用 D1。系统模型位于 `apps/service/src/sys-models`；系统 Schema 在管理页只读，记录仍可按权限管理。

## 模型编辑与示例

模型详情提供 JSON 编辑、草稿校验、内存预览和手动发布。保存草稿不改变已发布模型；发布创建不可变版本，旧页面写入受版本检查保护。稳定字段 `id` 在首次保存时补齐，后续编辑或改名时应保留。

预览记录只保存在当前页面内存中；修改有效 Schema 保留已录入记录。表格默认展示所有可读字段。筛选默认显示一条「字段 / 运算符 / 值」，通过加号按需添加，点击查询生效，重置恢复一条空条件；字段下拉提供后端授权支持的字段，包括只读身份字段。隐藏 UI 不改变服务端权限。

以下定义可以在模型管理页创建同 ID 模型后复制使用，不会自动导入数据库：

- [订单：枚举、多选和明细数组](examples/orders.definition.json)
- [内容管理：共享 richtext 契约](examples/cms.definition.json)
- [组织架构：自引用和 tree-list](examples/departments.definition.json)
- [客户档案：嵌套对象和本地引用](examples/customer-profile.definition.json)

## HTTP / MCP

MCP 使用 Streamable HTTP，端点为 `<Worker origin>/mcp`，在管理页签发 agent token：

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

本地使用启动器输出的 Worker 地址，Vite 也代理 `/mcp`。分离部署可设置 `VITE_FORMWORK_API_URL=https://<worker>/api/v1`。

| 工具                    | 用途                                                        |
| ----------------------- | ----------------------------------------------------------- |
| `formwork.describe`     | 指南、definition JSON Schema、模板及当前权限                |
| `formwork.capabilities` | Framework / Domain / Page / Window 组件、fn、源码和路由能力 |
| `models.list`           | 列出可管理模型                                              |
| `models.read`           | 读取共享草稿或发布定义及 management revision                |
| `models.validate`       | 校验新协议定义，返回 errors 和 runtimeChecks                |
| `models.write`          | 保存草稿；新建使用 `ifRevision:null`，修改使用最新 revision |
| `models.preview`        | 生成已登记路由的草稿预览链接                                |

创建流程为 `describe → capabilities → validate → write → preview`，发布仍在管理页手动完成。Resources 为 `formwork://guide`、`formwork://capabilities`、`formwork://definition-schema`。字段 format 的 Zod refinement、权限和关系目标仍需服务端校验，不能只依赖导出的 JSON Schema。

## 验证与部署

```sh
pnpm exec playwright install chromium
pnpm check
pnpm worker:dry-run
```

构建顺序为 formwork → vite-plugin → client → service。`pnpm check` 包含 lint、格式、构建、类型、Vitest 和 Playwright；E2E 使用隔离数据库。

```sh
pnpm --filter @alien-form/service exec wrangler login
pnpm deploy
pnpm capabilities:register --api-url https://<worker>/api/v1 --client-origin https://<worker>
```

`pnpm deploy` 将 `apps/client/dist` 和 API 发布到同一个 Worker。部署前设置 `apps/service/wrangler.json` 的 `FORMWORK_CLIENT_ORIGIN`。新库需要 `FORMWORK_BOOTSTRAP_ADMIN_USERNAME`、`FORMWORK_BOOTSTRAP_ADMIN_PASSWORD` 和 `FORMWORK_CAPABILITY_TOKEN`；部署脚本支持通过环境变量写入 secrets。

远端部署会初始化 metadata 并同步新协议系统模型，保留业务记录。**旧协议库必须先显式迁移**，部署脚本会阻止继续同步。`pnpm worker:dry-run` 仅打包，不修改数据库。

## 文档与代码入口

| 入口                                                  | 内容                                               |
| ----------------------------------------------------- | -------------------------------------------------- |
| [字段协议](docs/schema-design.md)                     | type / format、props、enum、relation、查询和默认值 |
| [运行时与代码归属](docs/formwork-api-architecture.md) | RenderItem、binding、四层装配与公共组件            |
| [旧协议迁移](docs/schema-migration.md)                | 离线候选转换、备份校验和原子升级计划               |
| [设计方案与实施状态](schema-protocol-proposal.md)     | 设计依据、约束与落地路径                           |
| `scripts/migrate-schema.ts`                           | 从旧定义生成候选及诊断                             |
| `apps/service/script/schema-upgrade.ts`               | 从 SQLite 备份生成可审阅的 SQL 事务计划            |
| `scripts/dev.mjs`、`scripts/e2e-server.ts`            | 开发及隔离测试编排                                 |
| `apps/service/script/database.mjs`、`migrate.ts`      | metadata、本地重建和远端系统模型同步               |
