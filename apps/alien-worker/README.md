# Alien Worker（Cloudflare 后端）

`apps/alien-worker` 是 Alien Form 的 **Cloudflare Workers 后端**，与 `apps/alien-server`
（Node 24 + `node:sqlite`）接口完全同构，但跑在 Cloudflare 上、数据落 **D1**。

单个 Worker 同时承担两件事：

- 托管 `apps/alien-mdm/dist` 静态资源（SPA，`not_found_handling: single-page-application`）；
- 处理 `/api/*` 请求（`assets.run_worker_first` 保证 API 优先于静态资源命中）。

前端切换后端只改一个环境变量 `VITE_API_BASE`，见 `apps/alien-mdm/.env.example`。

## 存储设计：两张通用表

与 Node 版「一模型一物理表」不同，Worker 版按需求用 **两张通用表** 承载所有模型
（不为每个模型建表），schema 见 `migrations/0001_init.sql`：

| 表        | 作用                                                                 |
| --------- | -------------------------------------------------------------------- |
| `schemas` | 模型配置态 schema（等价 Node 版 `_schemas` 元表），一模型一行 JSON   |
| `records` | 所有模型的记录：系统字段独立成列，其余字段收进 `data_content` JSON   |

`records` 表结构：

- 系统字段单独成列：`id`、`model`、`created_at`、`updated_at`（可直接索引 / 排序 / 过滤）；
- 其余所有业务字段（含 many-to-many 关系数组）塞进 `data_content` 一个 JSON 列；
- 过滤 / 排序通过 SQLite 的 `json_extract(data_content, '$.field')` 在应用层白名单驱动，
  仅 `x-database.filterable` / `sortable` 字段可用，避免 SQL 注入。

另有 `sessions` 表：Worker 无常驻内存态，登录会话必须落库才能跨请求 / 跨实例存活。

Schema 编译（字段 → 存储计划、引用字段发现）**复用** `apps/alien-server/src/schema/*`
的纯函数，保持前后端与两套后端「同一份 ModelSchema 语义」的单一真相源。

## 本地开发

```bash
# 首次：创建 D1 数据库，把返回的 database_id 填进根目录 wrangler.json
pnpm --filter @alien-form/alien-worker exec wrangler d1 create alien-mdm

# 建表（本地）
pnpm --filter @alien-form/alien-worker run migrate:local

# 构建前端（Worker 要托管 dist）
pnpm --filter @alien-form/alien-mdm run build

# 起本地 Worker（默认 http://localhost:8787，含 /api 与静态资源）
pnpm --filter @alien-form/alien-worker run dev

# 灌演示数据（走 HTTP 接口，与 Node 版同一脚本）
API_BASE=http://localhost:8787 node scripts/seed.js
```

## 部署

根目录 `wrangler.json` 已配置 `main` 入口、`ASSETS` 绑定与 `DB`（D1）绑定。

```bash
pnpm run build                                        # 构建前端 dist
pnpm --filter @alien-form/alien-worker run migrate:remote   # 远端建表
pnpm --filter @alien-form/alien-worker run deploy           # 部署 Worker + 静态资源
```

> 部署前需把 `wrangler.json` 里 `d1_databases[0].database_id` 替换为
> `wrangler d1 create alien-mdm` 返回的真实 ID。

## 接口清单（与 Node 版一致）

`POST /api/auth/login`、`POST /api/auth/logout`、`GET|POST|PUT|DELETE /api/schemas...`、
`POST /api/records/{list,options,subtree,:model,:model/batch-delete}`、
`GET|PUT|DELETE /api/records/:model/:id`、`GET /api/health`。
