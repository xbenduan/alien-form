# Alien Form / Formwork

Solid 无头表单内核、数据库模型工作台、Vite 代码能力清单和六项 stdio MCP 工具。唯一后端是 `apps/service` 的 Cloudflare Worker，开发使用本地 D1，部署使用 Cloudflare D1。

使用 Node **26.13.0**、pnpm **12.16.1**：

```sh
pnpm install --frozen-lockfile --registry=https://registry.npmjs.org
pnpm dev
```

启动器输出实际 Client/Worker URL 和私有账号文件路径。默认端口为 `5173` / `8788`，占用时自动选择可用端口；开发数据按用户和仓库隔离，重启保留。管理员随机用户名、密码与清单凭证仅保存在用户目录的 `bootstrap.json`（0600）。

登录后在模型工作台审阅 orders/cms 草稿并点击“手动发布”，随后进入业务页面。保存草稿不改变普通页面；发布后普通页面刷新才加载新 schema，旧页提交按当前版本校验。

```sh
pnpm exec playwright install chromium
pnpm check
pnpm worker:dry-run
```

- [启动、API、MCP、迁移与部署](docs/formwork-development.md)
- [公开契约与运行机制](docs/formwork-design.md)
- [重构决策和验收覆盖](docs/formwork-refactor.md)
- [Worker/D1 事务与权限](docs/backend-system-design.md)

旧 Worker、alienbase 和 protocol 已收敛移除；历史 SQL 与一次性迁移样本保存在 service 中。本轮执行本地验证，远端数据迁移和实际部署需要按目标环境单独执行。
