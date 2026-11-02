# Alien Form / Formwork

Solid 无头表单内核、数据库模型列表与 Schema 详情、Vite 代码能力清单和六项 stdio MCP 工具。唯一后端是 `apps/service` 的 Cloudflare Worker，开发使用本地 D1，部署使用 Cloudflare D1。

使用 Node **26.13.0**、pnpm **12.16.1**：

```sh
pnpm install --frozen-lockfile --registry=https://registry.npmjs.org
pnpm dev
```

启动器输出实际 Client/Worker URL 和私有账号文件路径。默认端口为 `5173` / `8788`，占用时自动选择可用端口；开发数据按用户和仓库隔离，重启保留。管理员随机用户名、密码与清单凭证仅保存在用户目录的 `bootstrap.json`（0600）。

`pnpm dev` 在启动 Worker 前自动应用本地 D1 migrations。旧定义的全局 `views.add/edit/detail` 会迁移到 `list`、`tree-list` 的同名 Window，保留已有局部覆盖；原始历史版本和草稿定义保存在 `fw_page_local_views_backup`。迁移不改变业务记录、版本号或 revision。清单登记失败时，终端会显示服务端错误及模型、View 路径。

登录后从模型列表打开 orders/cms 详情，左侧编辑 Schema，右侧预览，中间分隔条可拖动。审阅草稿并点击顶栏“手动发布”后即可进入业务页面。模型列表中的“固定到菜单”将已发布用户模型加入侧栏，固定状态按账号保存到 D1；系统模型直接展示。保存草稿不改变普通页面；发布后普通页面刷新才加载新 schema，旧页提交按当前版本校验。

开发启动器还会补充“组织架构”（departments）与“客户档案”（customer-profile）草稿，不覆盖已有模型。组织架构使用树形列表，可自行添加部门和上级关系；客户档案展示嵌套对象与地址数组卡片。实时预览从空列表开始，用户新增的记录仅保存在当前预览内存中，支持编辑、详情、删除及切换视图；修改有效 Schema 保留已录入记录，预览记录不写入后端。

列表中的对象、数组字段显示摘要与行内“详情”入口；点击后通过公共 Modal 展开该字段，复用完整记录的只读快照、原字段路径和 Domain 组件。详情不修改记录或改变路由，普通列表、树形列表与实时预览共用同一实现。

```sh
pnpm exec playwright install chromium
pnpm check
pnpm worker:dry-run
```

- [Formwork、Page、Window 与 Domain API](docs/formwork-api-architecture.md)
- [Schema、字段展示与页面定义](docs/schema-design.md)
- [完整目录树模型示例](examples/catalog.definition.json)
- [组织架构 tree-list 用例](examples/departments.definition.json)
- [客户档案对象与数组卡片用例](examples/customer-profile.definition.json)

旧 Worker、alienbase 和 protocol 已收敛移除；历史 SQL 与一次性迁移样本保存在 service 中。本轮执行本地验证，远端数据迁移和实际部署需要按目标环境单独执行。
