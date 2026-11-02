# Alien Form / Formwork

Solid 无头表单内核、数据库模型列表与 Schema 详情、Vite 代码能力清单和六项 HTTP/HTTPS MCP 工具。唯一后端是 `apps/service` 的 Cloudflare Worker，开发使用本地 D1，部署使用 Cloudflare D1。

使用 Node **26.13.0**、pnpm **12.16.1**：

```sh
pnpm install --frozen-lockfile --registry=https://registry.npmjs.org
pnpm dev
```

启动器输出实际 Client/Worker URL 和私有账号文件路径。默认端口为 `5173` / `8788`，占用时自动选择可用端口。每次 `pnpm dev`、`pnpm dev:local` 或 `pnpm dev:service` 都视为全新部署：删除本地 D1 的历史数据、模型、版本、菜单固定和登录凭证，按当前代码重新建库。管理员随机用户名、密码与清单凭证也会重新生成，仅保存在用户目录的 `bootstrap.json`（0600）。

系统模型固定定义在 `apps/service/src/sys-models`，管理页只读，用户和角色等记录仍可正常管理。数据库当前表结构写在 `apps/service/script/database.mjs`，部署时由 `script/migrate.ts` 执行，不维护版本化 migrations 或旧数据转换文件。清单登记失败时，终端会显示服务端错误及模型、View 路径。

新部署只初始化用户、角色和模型分类三个系统模型。普通模型示例统一放在 `examples/*.definition.json`，不自动导入本地或线上数据库；需要时，在已部署项目的模型管理页创建相同 ID 的模型，复制完整 definition JSON，保存草稿并手动发布即可。

模型详情左侧编辑 Schema，右侧预览，中间分隔条可拖动。模型列表中的“固定到菜单”将已发布用户模型加入侧栏，固定状态按账号保存到 D1；系统模型直接展示。保存草稿不改变普通页面；发布后普通页面刷新才加载新 schema，旧页提交按当前版本校验。

MCP 使用 Streamable HTTP，端点为 `<Worker origin>/mcp`。在 AI 客户端选择 HTTP/HTTPS 连接，在自定义 Headers 中填写 `Authorization: Bearer <agent token>`；agent token 在管理页的 API token 页面签发。客户端配置如下：

```json
{
  "mcpServers": {
    "formwork": {
      "url": "https://<worker>/mcp",
      "headers": {
        "Authorization": "Bearer <agent token>"
      }
    }
  }
}
```

本地使用启动器输出的 Worker HTTP 地址，例如 `http://127.0.0.1:8788/mcp`；Vite 开发服务也会代理 `/mcp`，模型列表可直接复制当前地址的配置。分离部署时设置 `VITE_FORMWORK_API_URL=https://<worker>/api/v1`，接入页会使用对应 Worker 的 `/mcp`。Worker 为每次请求校验凭证与当前权限，凭证撤销后立即生效；六项工具直接操作 D1 中的模型状态。`models.write` 只保存草稿，发布仍需在管理页手动完成。

示例包括订单（orders）、内容管理（cms）、组织架构（departments）和客户档案（customer-profile）。组织架构使用树形列表，可自行添加部门和上级关系；客户档案展示嵌套对象与地址数组卡片。实时预览从空列表开始，用户新增的记录仅保存在当前预览内存中，支持编辑、详情、删除及切换视图；修改有效 Schema 保留已录入记录，预览记录不写入后端。`examples/*.records.json` 提供可选示例数据，E2E 启动器仅在独立测试数据库中按需读取。

列表中的对象、数组字段显示摘要与行内“详情”入口；点击后通过公共 Modal 展开该字段，复用完整记录的只读快照、原字段路径和 Domain 组件。详情不修改记录或改变路由，普通列表、树形列表与实时预览共用同一实现。

```sh
pnpm exec playwright install chromium
pnpm check
pnpm worker:dry-run
```

- [Formwork、Page、Window 与 Domain API](docs/formwork-api-architecture.md)
- [Schema、字段展示与页面定义](docs/schema-design.md)
- [完整目录树模型示例](examples/catalog.definition.json)
- [订单模型示例](examples/orders.definition.json)
- [内容管理模型示例](examples/cms.definition.json)
- [组织架构 tree-list 用例](examples/departments.definition.json)
- [客户档案对象与数组卡片用例](examples/customer-profile.definition.json)

脚本按职责归属放置：

| 位置                                                           | 用途                                                                 |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `scripts/dev.mjs`、`scripts/dev-ports.mjs`                     | 项目开发启动、Client/Worker 编排、端口选择与进程回收                 |
| `scripts/e2e-server.ts`                                        | 项目 E2E 的独立 Client/Worker 环境，测试模型和数据从 `examples` 读取 |
| `scripts/register-capabilities.ts`                             | 将前端构建的能力清单登记到目标 Worker                                |
| `apps/service/script/local-worker.mjs`                         | 清空本地 D1、启动 Worker 和初始化系统模型                            |
| `apps/service/script/database.mjs`、`migrate.ts`、`deploy.mjs` | 当前表结构、本地重建、远端系统模型同步与服务部署                     |
| `examples/`                                                    | 手动复制使用的普通模型定义及可选示例数据                             |

```sh
pnpm deploy:service
pnpm capabilities:register --api-url https://<worker>/api/v1 --client-origin https://<client>
```

远端部署先执行 `migrate.ts` 初始化 metadata 并同步代码中的系统模型，再上传 Worker；保留远端账号和业务记录。系统模型新增字段会补充物理列并生成新版本；改变已有字段存储或关系时，需要直接在该脚本中明确处理。新库在首次请求时初始化管理员，需要设置 `FORMWORK_BOOTSTRAP_ADMIN_USERNAME`、`FORMWORK_BOOTSTRAP_ADMIN_PASSWORD`，清单登记需要 `FORMWORK_CAPABILITY_TOKEN`。可通过 Wrangler secrets 配置，也可通过环境变量传给部署脚本，由它使用私有临时文件执行 `wrangler secret bulk`。`pnpm worker:dry-run` 只检查 Worker 打包，不执行数据库操作或上传 secrets。
