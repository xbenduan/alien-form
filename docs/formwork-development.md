# Formwork 开发与验收说明

完整首版阶段 0–7 已实现。默认入口是 Solid 客户端与独立 Node 文件服务，orders 使用默认能力，cms 使用延迟加载的 RichText、Zod 和 fn 覆盖。旧 React 前端及 core/engine/react/sdk 已清理；旧后端协议、alienbase、Worker 保留为独立系统。

## 启动与工具链

固定 Node `26.13.0`、pnpm `12.16.1`、TypeScript `7.0.2`、Solid `1.9.17`、Vite `8.3.5`。版本由 `.nvmrc`、`packageManager` 与 `pnpm-lock.yaml` 固定。保留后端使用自己的 TypeScript `5.4.2`、Zod 3 和 Vitest 2。

```sh
# 使用 .nvmrc 中的 Node（已安装 nvm 时）
nvm install
nvm use

pnpm install --frozen-lockfile --registry=https://registry.npmjs.org
pnpm dev
```

`pnpm dev` / `pnpm dev:local` 先构建 formwork 与插件，再启动 client 和 service。Ctrl+C 回收这次启动的进程树。服务只监听 loopback，默认开发流程不执行 D1 迁移。

| 命令               | 作用                                                                       |
| ------------------ | -------------------------------------------------------------------------- |
| `pnpm dev`         | 客户端 `:5173` + 独立开发服务 `:8788`                                      |
| `pnpm dev:web`     | 只启动 client；先执行 `pnpm build:new` 并启动 service                      |
| `pnpm dev:service` | 只启动独立文件服务；先构建 formwork                                        |
| `pnpm build:new`   | 顺序构建四个新包与 TS7 声明                                                |
| `pnpm build`       | 新应用构建 + 保留后端构建、Worker dry-run                                  |
| `pnpm typecheck`   | 新包和根脚本类型检查；先构建包声明                                         |
| `pnpm test`        | 45 项新行为测试 + 68 项保留后端回归；先构建新包                            |
| `pnpm test:e2e`    | 临时两套客户端和独立数据的 6 项 Chromium E2E                               |
| `pnpm check`       | lint → format → build → typecheck → test → E2E，可从没有 dist 的工作区运行 |
| `pnpm dev:worker`  | 显式启动旧 Worker，沿用它的本地 D1 迁移                                    |

首次运行浏览器测试需要 `pnpm exec playwright install chromium`；Linux CI 使用 `--with-deps chromium`。

| 环境变量                | 默认值与用途                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `FORMWORK_CLIENT_PORT`  | `5173`，根启动器使用；例如 `FORMWORK_CLIENT_PORT=5188 pnpm dev`                     |
| `FORMWORK_SERVICE_PORT` | `8788`，服务监听端口及 client `/api` 代理目标                                       |
| `FORMWORK_DATA_DIR`     | `~/.local/share/alien-form/development/<项目路径的 SHA-256 前16位>`，独立持久化目录 |
| `VITE_MODEL_SOURCE`     | 默认 local；设为 `remote` 时，整个应用读取 `/api/models`                            |
| `FORMWORK_E2E_ROOT`     | Playwright 自动创建的临时目录，结束后删除；不用手动设置                             |

这台机器已安装的隔离工具也可直接使用，避免改变系统默认 Node：

```sh
export PATH="/Users/bytedance/Library/Caches/formwork-toolchain/node-v26.13.0-darwin-arm64/bin:/Users/bytedance/Library/Caches/formwork-toolchain/pnpm/package:$PATH"
```

## 页面与模型来源

| URL                                     | 实际行为                                             |
| --------------------------------------- | ---------------------------------------------------- |
| `/home`                                 | 入口和模型导航；`/` 跳转到这里                       |
| `/list/orders`                          | 默认字段、草稿筛选、三态付款筛选、标量排序和记录动作 |
| `/edit/orders/:id`                      | Modal 编辑已有记录                                   |
| `/add/orders`                           | Modal 创建新记录，可增加嵌套明细                     |
| `/detail/orders/:id`                    | Drawer 只读详情                                      |
| `/list/cms`、`/edit/cms/:id`            | 显式动态 Domain；示例记录 `article-1`                |
| `/models`、`/models/:domain`            | 完整模型目录、JSON 编辑、CAS 保存与实际 iframe 预览  |
| `/models/orders?router=edit&id=order-1` | 预览完整编辑 Window；edit/detail 必须提供记录 id     |

本地模型按 `apps/client/vite.config.ts` 的 glob 发现：

- `apps/client/src/models/orders/model.json`
- `apps/client/src/domains/cms/model.json`

模型目录由源的 `list()` 枚举，与 `domains` 定义独立。新建本地模型写到第一个模式的静态根 `src/models/{id}/model.json`；已有模型保留实际索引位置。浏览器与 MCP 都通过 Vite 中同一个文件源写入，调用者不能指定文件路径。

模型文件只保存 `{ id, title, data, views? }`。`id` 与 URL domain、Domain key、MCP modelId 一致。`revision` 是原始字节 SHA-256，属于 snapshot；格式变化也改变 revision。`ifRevision:null` 仅创建，更新必须提供最近 revision。冲突返回 `REVISION_CONFLICT`，没有自动重试。

开发期 `virtual:formwork/models` 是对象身份稳定的 HTTP 源，每次读取完整 snapshot。模型新增、删除、修改及坏 JSON 都触发 custom HMR；工作台刷新目录与预览，未保存草稿保留原 revision。普通编辑 Instance 保留挂载时的模型和值快照。坏文件显示错误，修复后自动恢复。

构建期 virtual 源打包完整文档，读取结果互相独立，`writable:false`，write 返回 `READ_ONLY`。`virtual:formwork/capabilities` 提供 `routes` 与 `capabilities(modelId, router)`；返回有效组件/fn、覆盖位置、原始 TS 声明与 JSDoc，普通模型使用默认能力，无需注册 Domain。

额外命名 View 只在文档层检查结构、Pointer 和表达式语法。指定 router 的有效 View 由工具检查，额外 View 的局部 scope 与组件在实际 Render 中检查，并列入 `runtimeChecks`。

## 独立开发 HTTP 服务

首次启动只为独立目录补入缺失的 orders/cms 模型及示例记录；重启保留模型版本和记录，不覆盖已有数据。

| 接口                               | 输入与结果                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /health`                      | 直接访问 service 的健康状态                                                        |
| `GET /api/models`                  | 完整模型目录                                                                       |
| `GET /api/models/:id`              | `completeness:"full"` 的 ModelSnapshot                                             |
| `PUT /api/models/:id`              | `{ document, ifRevision }`，校验、条件写入、返回新 snapshot                        |
| `POST /api/records/:modelId/query` | `{ filters, page, pageSize, sort?: { field, direction } }`；返回 `{ list, total }` |
| `GET /api/records/:modelId/:id`    | 读取单条记录                                                                       |
| `POST /api/records/:modelId`       | 记录 JSON，校验 DataSchema；未提供 id 时生成 UUID                                  |
| `PUT /api/records/:modelId/:id`    | 完整记录 JSON，body.id 必须与路径一致                                              |
| `DELETE /api/records/:modelId/:id` | 删除记录                                                                           |

字符串筛选为包含，boolean/number 为精确匹配；空筛选不提交，false 会提交。嵌套值按 DataSchema 校验。客户端通过保留 Host 的同源 Vite proxy 请求，浏览器写入要求同源 Origin；无 Origin 的本地工具请求必须携带 `X-Formwork-Tool: 1`。开发服务拒绝外部监听与跨源写入。

“上传到远端”明确读取已保存的 local snapshot，然后按远端 revision 写入独立服务；不上传当前未保存草稿，不切换当前来源。使用整个 remote 应用：

```sh
VITE_MODEL_SOURCE=remote FORMWORK_CLIENT_PORT=5188 pnpm dev
```

这是开发用的完整 HTTP Adapter 与文件存储；生产认证、权限、数据库、关系查询、publish 和历史迁移仍属于后续范围。

## MCP 连接与六项工具

先运行 Vite 开发服务，再启动 stdio：

```sh
pnpm mcp --url http://127.0.0.1:5173
```

stdio 使用官方 `@modelcontextprotocol/sdk`，只连接已有 Vite 工具端点，不另建模型写入源。stdout 只传 MCP，错误写入 stderr；服务不可用返回 `DEV_SERVER_UNAVAILABLE`。

MCP 客户端配置示例（按实际工作区和开发端口调整）：

```json
{
  "mcpServers": {
    "formwork": {
      "command": "node",
      "args": [
        "/Users/bytedance/Documents/cowork/alien-form/packages/formwork/dist/stdio.js",
        "--url",
        "http://127.0.0.1:5173"
      ]
    }
  }
}
```

客户端运行的 `node` 也必须是上述固定版本；可把 `command` 设为 Node 26 的绝对路径。

| 工具                    | 输入                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `models.list`           | `{}`                                                                                                  |
| `models.read`           | `{ "modelId": "orders" }`                                                                             |
| `formwork.capabilities` | `{ "modelId": "orders", "router": "list" }`                                                           |
| `models.validate`       | `{ "modelId": "orders", "document": { ... }, "router": "edit" }`；router 可省略，检查全部 schema 路由 |
| `models.write`          | `{ "modelId": "orders", "document": { ... }, "ifRevision": "<read 返回值>" }`                         |
| `models.preview`        | `{ "modelId": "orders", "router": "edit", "params": { "id": "order-1" } }`                            |

validate 返回 `{ errors, runtimeChecks }`。未知 router、缺少预览参数、无法静态确定的定义或不安全 schema 给出明确诊断。表达式返回值、依赖与网络行为必须在浏览器验收。

## 验收证据与构建边界

2026-10-29 在真实固定工具链执行：

| 验收                  | 证据                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| Node / Solid Chromium | 29 项 Node + 16 项 browser：模型、完整源、Vite、stdio、HTTP、数组身份、表达式、Window、清理             |
| 客户端 E2E            | 6 项通过：筛选、同 id 刷新、Modal/Drawer、History/焦点、嵌套明细、cms、CAS/HMR、两源/上传、文件目录恢复 |
| 生产模型源            | 实际 Vite library build 后在 Node 读取完整只读快照，修改文件不影响产物，写入拒绝                        |
| 保留后端              | protocol 16 + alienbase 7 + Worker 45 项回归；独立 TS5 构建与 Wrangler dry-run                          |
| 新包                  | TS7 类型及声明、Vite 生产构建、cms 独立动态 chunk；client 主 JS 176.38 kB / gzip 58.77 kB               |
| Node 入口             | `formwork/model` 和 `formwork/mcp` 在没有 document 的 Node 进程实际导入                                 |
| 完整交付链            | 冻结安装通过；移出四个新包的 dist 后，`pnpm check` 仍全部通过，E2E 7.3s                                 |
| 根启动器              | 自定义 client :5188 / service :8790，模型读取、保留 Host 的同源写入、退出后两个监听端口回收通过         |

E2E 监听 `127.0.0.1:5184`、`:5186` 和 service `:8788`，复制客户端到临时目录，不修改真实模型或旧 D1。故意错误、清理异常用例会输出相应错误日志。

默认静态构建产物是 `apps/client/dist`，`deploy.json` 已指向此目录。生产静态源只读，记录请求仍需要适配同源 `/api` 服务；Vite 开发 proxy 不会进入静态产物。当前没有生产 Node 服务或完整发布流程，不能把新 client 直接接到旧 Worker 的 `/api/v1`。

旧 `wrangler.json` 已移除删除前端的 ASSETS 绑定，Worker 只保留原 D1 和 `/api/v1` 后端，非 API 路径返回 404。协议能力快照保留，旧 UI 生成链已移除。所有验证使用本地测试或 dry-run，本次未 commit、push 或部署。
