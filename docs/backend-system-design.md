# Formwork Worker/D1 后端设计

`apps/service` 的 Hono module Worker 是唯一后端。D1 保存完整定义、共享草稿、不可变发布版本、代码能力清单、身份与业务记录；每请求以当前数据库状态鉴权和校验。

## 执行路径与职责

```text
Client / stdio MCP → HTTP /api/v1 → Bearer 身份与当前角色
                                   ↓
                        ModelService / RecordService
                                   ↓
                      D1 compiler / repository / batch
```

| 位置                                                   | 职责                                                |
| ------------------------------------------------------ | --------------------------------------------------- |
| `apps/service/src/index.ts`、`app.ts`                  | Worker fetch、Hono 路由、CORS、请求体限制、DTO/错误 |
| `src/seed.ts`                                          | 新库系统定义与随机可信身份首次入库，已有状态不重置  |
| `src/application/auth`                                 | PBKDF2、token 摘要、身份类型、角色子树和授权投影    |
| `src/application/model-service.ts`                     | 草稿、校验、CAS、发布、版本与 runtime/preview       |
| `src/application/record-service.ts`                    | 权限、参数查询、合并、当前 schema、关系与记录事务   |
| `src/application/behaviors/rules.ts`                   | 可信系统行为与事务断言                              |
| `src/application/capabilities.ts`                      | 清单校验、摘要、origin、幂等登记与组件引用保护      |
| `src/adapters/d1`                                      | SQL、物理存储计划、不可变版本、事务 guard 与值编码  |
| `src/application/outbox.ts`                            | 记录事务内写事件，提交后派发并记录失败              |
| `src/migration`、根 `scripts/migrate-formwork-data.ts` | 一次性转换、守恒核对与本地 apply                    |

共享 `formwork/model` 只提供 JSON、schema、HTTP DTO 与 API client。Worker 不执行前端源码、Domain 或任意上传表达式；可信 behavior 只引用 Worker 注册规则。浏览器负责 Domain、View props、代码函数与交互。

## 管理状态与事务

`fw_models` 持有管理 revision 和 active_version；`fw_model_drafts` 保存原始 definition 与 diagnostics；`fw_model_versions` 保存不可变定义和真实 storage manifest。管理 revision 与发布 revision 分离，调用方只能做相等比较。

| 操作     | 事务规则                                                                     |
| -------- | ---------------------------------------------------------------------------- |
| 新建草稿 | `ifRevision:null`；断言模型不存在，PK/guard 阻止并发双创建                   |
| 更新草稿 | 必填 revision；同一 batch 检查管理 revision、保存 draft、更新 revision       |
| 手动发布 | 仅 user；校验草稿、当前能力清单、storage plan                                |
| 发布提交 | 同一 batch guard → DDL → version → active pointer → 删除 draft → 清理 guard  |
| 记录写入 | 按当前 active_version 授权与校验；batch 再断言版本、记录旧值、关系和系统约束 |

`fw_commit_guards` 用 CHECK(ok=1) 的临时断言语句使 D1 batch 失败并整体回滚。不能将 UPDATE changes=0 当作事务后确认，否则其他语句可能已经提交。失败不留下 guard、不切换 active pointer、不删除草稿。

记录校验后发生并发发布，返回 `409 SCHEMA_CHANGED`；同一管理 revision 竞争返回 `409 REVISION_CONFLICT`。存储失败返回定位诊断，原版本继续生效。

## 物理存储与演进

每模型主表保存 id、created_at、updated_at、creator_id、nullable 业务列和 data_content。根字段 binding.id 是稳定身份，path 为 JSON Pointer，物理列或 jsonKey 决定存储位置。权限和关系引用 binding.id。

删除字段仅将 manifest binding 标记 inactive，保留物理列及历史值。后续重建合并历史 manifest 与实际 PRAGMA，不因当前可见字段减少而丢失更早版本的数据。required 在 Worker 执行，不为新业务列增加物理 NOT NULL；旧 NOT NULL 阻碍新定义时用保留全部列和值的影子表放宽。

同一字段存储不兼容的类型或映射变化阻止发布，要求明确迁移。收紧 JSON schema 可以使旧记录暂时无效，旧记录仍可读取；新提交必须有效。UNIQUE 索引等物理约束建立失败不能绕过，DDL rollback 保留原版本和草稿。

主表、through 表和 `fw_*`/SQLite 保留表的所有权严格检查，不能绑定其他模型或认证表。many-to-many 在记录 batch 中去重并同步 through；关系目标、引用存在性与删除保护都有事务断言。

## 身份与授权

`fw_credentials` 只保存 token_hash，身份 kind 来自可信记录，不从 URL/query/header 中接受覆盖。user 登录会话才能发布/查看版本/管理本人 token；agent 可管理授权模型草稿，deploy 仅登记能力清单。超级身份也不绕过 kind 限制。

系统定义使用 `system-users`、`system-roles`、`system-model-categories`，可信超级角色 ID 保存在 `fw_system_identities`；业务新记录使用 UUID。保留历史 ID 与密码摘要仅由迁移接入。

角色有效集合沿用子树聚合，动作与字段取并集，all 优先于 own；私有字段优先排除。manage/publish 与 record read/create/update/delete 分离，草稿中的 grants 不参与当前授权。

runtime schema 不含 backend。字段投影同步处理 required、$defs/$ref 和 View 引用，根 object/array 子树整体授权。update 先拒绝未授权提交字段，再与存量隐藏值合并，最后校验完整数据；客户端省略隐藏字段不会清空历史值。记录 owner 由服务端生成，own 过滤和写入检查一致。

## 能力清单与事件

Vite 输出 routes、schemaRouters、默认/Domain 能力、源码位置、声明、JSDoc 与 runtimeChecks，没有模型快照。deploy 登记检查 SHA-256、origin 和 appId；同 revision 幂等。删除已发布 View 依赖的组件会被拒绝。

记录事件与数据在一个 batch 中写入 `fw_outbox`，payload 排除私有字段和密码。提交后 `waitUntil` 派发；当前可信 handler 是可重试的 `audit.record`，记录 attempts/last_error/delivered_at。外部消费者需以事件 ID 幂等，旧 handler 不自动重放。

## 迁移和验证边界

活动 migration 只有 `apps/service/migrations` 的新协议；旧 SQL 在 legacy-migrations 中作为历史输入。迁移只读盘点源副本，生成新定义/字段/授权/关系映射，显式本地事务 apply，并在提交前核对数量和值摘要；相同输入不覆盖后来状态。旧展示配置使用新默认 View 并保留原始输入，无法转换的执行行为阻止 apply。

真实 workerd/D1 tests 验证 CAS、DDL rollback、版本 guard、历史列、权限/关系/事件与 stdio；Chromium 验证管理页手动发布、旧页面 schema/输入快照及当前提交错误。代码完成不代表远端 inventory、数据迁移或部署已经执行。
