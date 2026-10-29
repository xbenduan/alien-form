# Formwork 后端收敛与验收

重构已将模型与业务事实统一到 Cloudflare Worker/D1。代码结构为 `packages/formwork`、`packages/vite-plugin`、`apps/client`、`apps/service`，客户端和 MCP 使用同一 HTTP 契约。

## 已确认决策对应的实现

| 决策                            | 结果                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| 后端拥有完整模型                | definition 将 document、storage、relations、permissions、behavior 一起持久化和版本化 |
| Page 加载、Domain 定制          | 显式 loader → JSON/Zod → Domain `ctx.schema` → RuntimeSchema                         |
| MCP 最新共享草稿                | 六工具通过 HTTP；无草稿读取最新发布，首次修改创建草稿                                |
| 只管理页手动发布                | 保存只返回 draft/diagnostics；user + publish 权限 + 审阅 revision 才可发布           |
| 开发本地 D1、部署 Cloudflare D1 | 相同 Worker 入口、migration 与 API；运行位置不影响 API 唯一来源                      |
| 无必要不兼容                    | 删除旧 Worker/alienbase/protocol；旧 ID 和协议仅用于一次性迁移                       |
| 刷新后更新                      | 新挂载读取最新发布；旧 Instance 保留 schema/输入，提交按当前版本报具体错误           |
| 删除字段保留物理值              | manifest inactive、历史列合并、NOT NULL 影子表放宽                                   |
| 收紧约束允许旧记录无效          | 读存量不强制重新校验；提交必须满足当前已发布 schema                                  |
| 无效草稿可保存                  | JSON 身份必须正确；不完整内容持久化诊断，不能发布                                    |

## 七阶段交付覆盖

| 阶段             | 代码与验证                                                           |
| ---------------- | -------------------------------------------------------------------- |
| 1 契约/运行时    | API、快照、RuntimeView 代码 props、两阶段加载及 owner/abort          |
| 2 Worker/D1/身份 | fw_* metadata、系统首次入库、密码与摘要 token、role/own/CORS         |
| 3 草稿/发布/记录 | CAS、batch guard、原子 DDL、关系、字段投影、outbox、当前 schema      |
| 4 清单/MCP       | 静态分析与生产清单、幂等登记、官方 SDK 六工具、agent 发布拒绝        |
| 5 管理页         | 登录/退出/token、完整 definition、诊断、只读版本、禁写预览、手动发布 |
| 6 迁移/删除旧包  | 只读 inventory、plan、显式本地 apply、历史 ID/hash/owner/关系守恒    |
| 7 开发/全仓验收  | 私有用户目录 D1、生产入口启动、单一 E2E、CI/check/dry-run            |

文件模型发现、上传、local/remote 来源切换、模型 HMR、生产模型快照和 Vite 模型工具端点已删除。Vite 的普通代码 HMR 保留，只更新代码能力清单，不发布草稿或重建普通模型页。

## 必须持续验证的行为

- 同 revision 的草稿创建/更新/发布竞争只有一个成功，冲突不自动覆盖。
- 发布 DDL/UNIQUE 失败时数据库、版本目录、active pointer 和草稿整体保持。
- 记录校验后发生并发发布，schema guard 拒绝按旧版本写入。
- 停用字段的列和值跨多次发布/重建仍存在，存储不兼容变更要求迁移。
- required/private/$ref/View 投影一致，隐藏值更新保留，恶意字段提交拒绝。
- agent 和 deploy 即使代表超级管理员也不能发布，token 撤销立即生效。
- 未发布/无效草稿不影响普通页面，preview 永远阻断注入 API 的业务写入。
- 普通页面刷新取新 schema，旧页提交 422 并保留输入、展示字段定位。
- 迁移提交前核对摘要，失败整体回滚，相同输入不覆盖后来的草稿。

验证使用真实 Wrangler/workerd、本地 D1、官方 stdio SDK 和 Chromium。测试 fixture 导入已发布基线仅用于隔离数据库，实际发布路径有管理页按钮 E2E。运行方式和目标环境发布顺序见 [开发说明](./formwork-development.md)，公开运行时见 [契约设计](./formwork-design.md)。
