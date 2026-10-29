# Formwork 启动、API 与验收

`apps/service` 是唯一 Worker 后端。客户端与 MCP 通过 `/api/v1` 访问 D1 中的模型定义、共享草稿、发布版本与记录；Vite 只负责代码分析、转换和能力清单登记。

## 启动与持久化

固定 Node `26.13.0`、pnpm `12.16.1`、TypeScript `7.0.2`。安装和开发：

```sh
nvm use
pnpm install --frozen-lockfile --registry=https://registry.npmjs.org
pnpm dev
```

启动器先构建 formwork 和 Vite 插件，应用 `apps/service/migrations` 的本地 D1 migration，启动生产 Worker 入口并等待 health/bootstrap，然后启动 Vite 并等待能力清单登记成功，最后通过 API 补入缺失的 orders/cms 草稿。样例不自动发布、不创建业务记录。登录管理页后审阅并手动发布即可使用。

| 配置                        | 用途                                                                       |
| --------------------------- | -------------------------------------------------------------------------- |
| `FORMWORK_CLIENT_PORT`      | 默认 5173；显式端口被占用直接失败，默认端口被占用向后选择                  |
| `FORMWORK_SERVICE_PORT`     | 默认 8788；Worker 端口和 Vite 代理目标                                     |
| `FORMWORK_DATA_DIR`         | 默认 `~/.local/share/alien-form/development/<仓库绝对路径 SHA-256 前16位>` |
| `VITE_FORMWORK_API_URL`     | 浏览器 API base；默认同源 `/api/v1`，生产独立部署时设为真实 Worker API URL |
| `FORMWORK_CLIENT_ORIGIN`    | Worker 的客户端 origin 允许列表，以逗号分隔；开发由启动器设置              |
| `FORMWORK_CAPABILITY_TOKEN` | Vite 或登记脚本使用的 deploy credential，只在服务端环境读取                |
| `FORMWORK_E2E_ROOT`         | Playwright 临时隔离目录，不使用开发 D1                                     |

开发目录权限为 0700。首次生成 `bootstrap.json`（0600），保存随机用户名、密码和 deploy token；终端仅显示文件路径。`.dev.vars` 同样为 0600，secret 不通过 `VITE_*`、define 或客户端资源传递。重启复用账号和数据库，不重置已发布模型。

Ctrl+C 回收本次启动的 Vite 和 Worker 进程树。不要将原文件服务目录当作新 D1；旧数据先用下文的迁移工具盘点。

| 命令                                   | 行为                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm dev:local`          | 管理本地 migration、私有凭证、Worker 与 Vite 的完整启动                     |
| `pnpm dev:web`                         | 独立 Vite；需先启动 Worker 并设置 deploy token、Worker 端口与 client origin |
| `pnpm dev:service` / `pnpm dev:worker` | 直接 Wrangler；需自行提供本地 migration 与 `.dev.vars`                      |
| `pnpm build`                           | 顺序构建 formwork、Vite 插件、client、service                               |
| `pnpm typecheck`                       | 四包及根启动/迁移脚本类型检查                                               |
| `pnpm test`                            | Node 契约、真实 Worker/D1、迁移、stdio 和 Solid Chromium                    |
| `pnpm test:e2e`                        | 一套真实 Vite + Worker/D1 的浏览器验收                                      |
| `pnpm check`                           | lint → format → build → typecheck → test → E2E                              |
| `pnpm worker:dry-run`                  | 编译 Worker，无实际部署                                                     |

## 管理与业务页面

| URL                                            | 行为                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `/login`                                       | 密码登录；sessionStorage 仅保存当前标签页会话，重新装载通过 `/auth/me` 核实 |
| `/`、`/home`                                   | 进入 `/models`，未登录进入登录页                                            |
| `/models/:domain?`                             | 完整 definition、可诊断草稿、CAS 保存、管理预览、手动发布和只读版本目录     |
| `/model-preview/:domain?router=add&revision=…` | 指定审阅 revision 的独立管理预览；业务写入禁用                              |
| `/tokens`                                      | 本人 agent/deploy token 签发、一次性明文及撤销                              |
| `/list/orders`、`/list/cms`                    | 读取授权的最新已发布 schema，分页、筛选和记录操作                           |
| `/add/:domain`、`/edit/:domain/:id`            | Modal 创建/编辑记录                                                         |
| `/detail/:domain/:id`                          | Drawer 只读详情                                                             |

普通页面新挂载或刷新加载已发布 schema。发布不轮询、不重建旧实例；旧实例仍保留 schema 和输入，提交按当前发布规则校验，返回字段 JSON Pointer 和具体错误。

管理预览通过受管理权限保护的 draft-schema API 加载；普通业务页不会因为 revision/query 参数读取草稿。未发布模型列表为空，新建预览使用默认值；edit/detail 必须提供真实记录 ID，且模型已有发布基准。预览复用普通 Page、Window 内容和 Domain，并拦截注入 API 的记录写入。

## HTTP `/api/v1`

成功直接返回 DTO；失败为 `{ error: { code, message, issues?, currentRevision? } }`。除 health/login 外使用 `Authorization: Bearer <credential>`。数据库仅保存 token 摘要，撤销与过期每次请求检查。

| 方法与路径                                                      | 语义                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| `GET /health`                                                   | Worker 与 D1 就绪                                         |
| `POST /auth/login`                                              | `{ username, password }` → 用户会话                       |
| `GET /auth/me`、`POST /auth/logout`                             | 当前可信身份、撤销当前 user session                       |
| `GET/POST /auth/tokens`                                         | 本人目录 / `{ label, kind, expiresInDays }` 签发          |
| `DELETE /auth/tokens/:id`                                       | user 撤销本人 credential                                  |
| `GET /models`、`GET /models/:id`                                | 可管理目录、优先最新草稿的完整管理快照                    |
| `PUT /models/:id/draft`                                         | `{ definition, ifRevision }`，不完整草稿返回 diagnostics  |
| `POST /models/:id/validate`                                     | `{ definition, router? }` → errors/runtimeChecks          |
| `POST /models/:id/publish`                                      | user + publish 权限；`{ ifRevision }` 发布已保存草稿      |
| `GET /models/:id/versions`、`GET /models/:id/versions/:version` | user 读取不可变发布版本                                   |
| `GET /models/:id/preview?router=…&params=…`                     | params 为字符串对象 JSON；返回预览 URL                    |
| `GET /models/:id/draft-schema?revision=…`                       | user 管理预览，CAS 检查审阅版本                           |
| `GET /runtime/models/:id/schema`                                | 授权投影 schema/version/revision，无 backend              |
| `GET /formwork/capabilities?modelId=…&router=…`                 | 路由有效代码声明与运行时检查                              |
| `PUT /formwork/capabilities/:appId`                             | deploy 登记并激活能力清单                                 |
| `POST /records/:modelId/query`                                  | `{ filters, page, pageSize, sort?, keyword?, parentId? }` |
| `GET /records/:modelId/:id`                                     | 授权记录                                                  |
| `POST /records/:modelId`、`PUT /records/:modelId/:id`           | 创建、合并更新，当前 schema 校验                          |
| `DELETE /records/:modelId/:id`                                  | 删除，关系引用检查                                        |
| `POST /records/:modelId/batch-delete`                           | `{ ids }`，逐条结果                                       |
| `POST /records/:modelId/options`                                | 关系候选项与选中值补齐                                    |
| `POST /records/:modelId/subtree`                                | 已声明父级关系的子树                                      |
| `POST /records/:modelId/commands/:command`                      | 已注册可信命令                                            |

`ifRevision:null` 只创建不存在的模型，其他草稿写入和发布必须携带最近管理 revision。冲突返回 `409 REVISION_CONFLICT`，编辑文本保留，不自动改用最新 revision。记录并发发布返回 `409 SCHEMA_CHANGED`；数据不符合当前 schema 返回 `422 INVALID_VALUE`。详情 metadata 可以包含服务端时间和 owner，表单只加载 schema 声明字段，隐藏存量由服务端合并。

## MCP stdio

通过管理页签发 agent token，在 MCP 服务进程环境提供 `FORMWORK_API_TOKEN`，连接现有 Worker：

```sh
pnpm mcp --url http://127.0.0.1:8788/api/v1
```

stdout 仅传 MCP 协议，错误写 stderr。可连接本地或远端 HTTP(S) Worker，URL 使用真实 `/api/v1` base；管理页给出当前 API base 和 stdio 入口路径。

```json
{
  "mcpServers": {
    "formwork": {
      "command": "node",
      "args": [
        "/项目绝对路径/packages/formwork/dist/stdio.js",
        "--url",
        "http://127.0.0.1:8788/api/v1"
      ],
      "env": { "FORMWORK_API_TOKEN": "<agent token>" }
    }
  }
}
```

| 工具                    | 输入                                  |
| ----------------------- | ------------------------------------- |
| `models.list`           | `{}`                                  |
| `models.read`           | `{ modelId }`                         |
| `formwork.capabilities` | `{ modelId, router }`                 |
| `models.validate`       | `{ modelId, definition, router? }`    |
| `models.write`          | `{ modelId, definition, ifRevision }` |
| `models.preview`        | `{ modelId, router, params? }`        |

MCP 永远处理最新共享草稿；无草稿读取最新发布定义，首次修改创建草稿。agent 没有发布工具，即使代表超级管理员也不能调用发布 API；deploy 只登记清单。

## 一次性数据迁移

旧 0001–0013 SQL 位于 `apps/service/legacy-migrations`，不在活动 migrations_dir。旧协议与文档样本位于 `apps/service/src/migration/fixtures`，仅用于一次性输入。转换器保留记录/user ID、字段身份、物理值、owner、grants 和 through 关系；不能可靠转换的行为报错，旧展示配置保存在迁移输入中并报告默认 View 替代。

```sh
# 只读盘点独立 SQLite 副本和原文件服务保存目录
pnpm migrate:data --source-db /备份/legacy.sqlite --file-state /备份/旧文件目录 --output /备份/inventory.json
# 生成 SQL 与守恒报告，不执行
pnpm migrate:data --mode plan --input /备份/inventory.json --output /备份/plan.json
# 仅在另一个本地 SQLite 副本显式执行；先停止该副本 Worker
pnpm migrate:data --mode apply-local --input /备份/inventory.json --target-db /副本/new.sqlite
```

默认 mode 为 inventory，没有远端 apply。`--samples` 只导入普通示例草稿。原文件服务的已保存历史模型与旧 D1 的已发布定义可以导入基准版本。所有目标表数量和值摘要在本地事务提交前核对，失败整体回滚；相同输入摘要重复导入不覆盖后来修改。

## 部署与恢复

静态客户端产物为 `apps/client/dist`，Worker 入口为 `apps/service/src/index.ts`。生产客户端若独立部署，构建时配置 `VITE_FORMWORK_API_URL=<真实 Worker origin>/api/v1`；Worker 的 `FORMWORK_CLIENT_ORIGIN` 配置真实客户端 origin。

发布前先盘点并备份目标 D1，在隔离副本验证迁移与数据守恒。新 metadata 使用 `fw_*`，不要对已有旧数据库无差别重放历史 SQL。配置管理员引导用户名/密码（新库必需）、D1 binding 和 client origin；使用 Wrangler secret 或部署环境提供凭证，禁止把 secret 配置为 `VITE_*`。

部署 Worker 与静态客户端后，通过用户会话签发 deploy token，以环境变量向构建清单登记脚本提供：

```sh
# 该命令会向指定 Worker 写入清单，属于实际发布流程
pnpm capabilities:register --api-url https://<Worker 域名>/api/v1 --client-origin https://<客户端域名>
```

脚本读取 `apps/client/dist/formwork-capabilities.json`，填入客户端 origin、重新计算内容 revision，再登记。生产构建不包含模型快照和 token；只有清单登记后草稿才能按当前代码能力发布。新增模型仍只能管理页手动发布。恢复依据数据备份和迁移记录，不以重放旧 SQL 或 MCP 自动发布代替回退。

## 已执行的本地验收

真实 Worker/D1 覆盖 CAS、原子 DDL 回滚、并发发布/记录 guard、字段投影、own、角色子树、关系及保留历史列。MCP 使用官方 SDK stdio 对真实 Worker 验证六工具与 agent 发布拒绝。迁移验证历史密码登录、owner/关系与事务守恒。

8 项 Chromium E2E 覆盖密码登录、Window/焦点/History/分页/Select、cms Domain、无效草稿、有效预览禁写、手动发布、刷新生效、旧页 422 保留输入、CAS 与 token 撤销；包含 1440px / 390px 截图和页面溢出检查。E2E 使用临时 D1 基线，测试结束回收自身进程，不修改开发或远端数据库。
