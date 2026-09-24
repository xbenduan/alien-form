# Alien Worker 后端系统设计

## 架构定位

后端采用模块化单体与六边形架构。协议是唯一真相源，运行时只执行协议编译后的约束和模型模块声明的受控扩展。

依赖方向固定为：

```text
Hono HTTP Adapter
        ↓
Worker Bootstrap 组合根
        ↓
AlienBase Runtime Ports
        ↑
D1 Repository / Compiler Adapters
```

## Core 边界

`packages/alienbase` 是数据库与平台无关的框架包，导出 `defineCore`、`defineModel`、
统一运行时服务和端口契约。它不提供 D1、SQLite 或 PostgreSQL 适配器。

`apps/alien-worker/src/bootstrap/core.ts` 是当前项目唯一的组合根，负责将 D1 Repository、
模型编译器、认证与事件派发器注入 AlienBase Runtime。运行时内核的修改属于高风险变更，
必须重点审查执行顺序、权限边界、事务一致性和跨模型回归。

AlienBase Core 仅包含：

- 用户模型定义发布与版本控制。
- 记录读写的统一执行管道。
- 模型中间件生命周期调度。
- 协议级记录校验与可见性。
- Core 所需的端口契约。

AlienBase Core 不允许：

- 导入 `apps/alien-worker/src/models/*` 中的具体模型。
- 硬编码模型名、字段名或系统记录 ID。
- 承担登录、会话或角色解析等认证域实现。
- 承担启动编排、种子数据或模型构造工具。
- 允许模型扩展绕过权限、校验、事务或持久化流程。

## 职责分层

| 目录或文件                                        | 职责                                               |
| ------------------------------------------------- | -------------------------------------------------- |
| `packages/alienbase/src/runtime/`                 | 所有模型必经的执行内核、权限决策和端口             |
| `packages/alienbase/src/define-core.ts`           | 项目级静态模型清单与请求级 Core 工厂               |
| `packages/alienbase/src/define-model.ts`          | 数据库无关的模型模块与初始化上下文                 |
| `apps/alien-worker/src/bootstrap/core.ts`         | Worker 唯一组合根与 isolate 初始化协调器           |
| `apps/alien-worker/src/application/`              | 认证、编译模型注册、模型策略与 Outbox 派发         |
| `apps/alien-worker/src/models/`                   | 代码模型的协议、初始化、生命周期、Command 和消费者 |
| `apps/alien-worker/src/adapters/d1/compiler/`     | D1 存储计划、查询表达式与协议编译                  |
| `apps/alien-worker/src/adapters/d1/repositories/` | AlienBase 端口与会话端口的 D1 实现                 |
| `apps/alien-worker/src/http/`                     | Hono 应用、路由、中间件、输入输出适配              |
| `apps/alien-worker/src/index.ts`                  | Cloudflare Worker 最小入口                         |

Worker 为每个请求通过 `createCore({ db })` 创建独立运行时，不跨请求共享请求态对象。
模型定义通过 `defineCore.models` 中的字面量动态导入静态注册，使 Worker 构建器能够确定
完整模块图，不再通过文件扫描生成 manifest。只有携带 `schema` 的定义才进入代码模型
目录并占用系统模型名；`name` 与 `match` 定义只为数据库 Schema 附加行为，不改变模型
所有权。系统模型 Schema 始终从代码目录读取，不写入 `models` 表；`models` 表只保存
用户创建的模型。系统模型物理表只允许通过显式 D1 migration 变更，修改代码 Schema
不会触发建表或字段迁移。

种子数据初始化由 `initializeCore` 在每个 isolate 内只成功执行一次：首批并发
请求共享同一个 Promise，失败时清除缓存并允许后续请求重试。多 isolate 间仍依赖初始化
操作自身的数据库幂等性。

权限职责进一步拆分为：

```text
auth/RoleAccessProfileProvider
  用户与角色模型 → AccessProfile
                     ↓
alienbase/AccessControl
  操作授权、数据范围、字段与 Schema 裁剪
```

`AccessControl` 属于 Core，并由 `ModelService` 与 `RecordService` 强制调用。
`RoleAccessProfileProvider` 属于 Auth，只负责读取具体身份与角色模型，不参与权限决策。

## 执行约束

写操作固定经过以下阶段：

```text
解析 → 鉴权 → prepare → 默认值与结构归一化 → 协议表单校验
    → 业务 validate → beforePersist
    → TransactionPlan（记录变更 + 领域事件）
    → D1 batch 原子提交（业务表 + Outbox）→ present
```

协议表单校验是 Core 的强制阶段，直接调用 API 或由 Command 生成 mutation 都不能绕过。
它递归执行字段白名单、`type`、`required`、`pattern`、字符串长度、数值范围和数组长度约束。
这些静态约束由浏览器表单和服务端共享实现。`x-validate` 只允许代码函数或
`{{...}}` 表达式，用于浏览器中的复杂自定义校验，不在服务端执行。

模型只能通过固定生命周期扩展行为：

- `prepare`
- `validate`
- `beforePersist`
- `present`

同一模型可同时命中多个定义。注册表先按声明顺序组合全部 `match` 定义，再组合
`name` 或 `schema.name` 精确定义。`prepare` 与 `present` 依次传递结果，
`validate` 与 `beforePersist` 依次执行。业务 `validate` 只负责查库、跨字段和领域不变量，
不应重复实现 Schema 已表达的必填、类型或正则规则。`beforePersist` 只能通过
`EventCollector` 追加事件，不能自行提交事务或直接执行外部副作用。

模型专属业务使用声明式 `commands`。Command 必须声明操作权限和允许写入的字段，
返回 mutation 与 event，由同一条记录执行管道再次完成字段鉴权、生命周期和协议校验。
多个定义中的 Command 名称不得重复，冲突会在 `CompiledModel` 编译时失败。
HTTP 入口统一为 `POST /api/v1/records/:model/actions/:command`。

## 编译与缓存

`CompiledModels` 优先从代码目录读取系统 Schema，找不到时才从模型仓储读取用户 Schema。
Schema 来源确定后，注册表只按统一协议匹配行为，下游不再区分代码模型和数据库模型。
最终按 `model@version` 编译、缓存以下不可变计划：

- 存储表、字段、索引与关系计划。
- 查询字段表达式及过滤、排序能力。
- 公私字段策略。
- 校验字段映射。
- 所有匹配定义组合后的生命周期、Command 和事件消费者。

读写服务、鉴权身份解析、引用展开和模型策略只接收 `CompiledModelProvider`，
不会在请求路径中重复解释协议。用户模型发布后必须使该模型的缓存失效。

## 事务与事件

D1 不提供跨任意异步逻辑的交互式事务。本系统先完成读取、鉴权、生命周期与校验，
再生成完整 `TransactionPlan`，由 `D1RecordRepository.commit()` 将所有业务 SQL 和 Outbox
写入合并为一次 `D1Database.batch()`。任一语句失败时，整批操作回滚。

提交后，Worker 使用 `executionCtx.waitUntil()` 调用 `OutboxDispatcher`。消费者成功后
写入 `processed_at`；失败则增加 `attempts` 并保存 `last_error`，供后续请求重试。
同一主题命中的消费者按定义组合顺序全部执行。因此外部通知等副作用不阻塞事务，
也不会在业务提交前执行。

## 端口边界

AlienBase Runtime 只能依赖 `packages/alienbase/src/runtime/contracts.ts` 中定义的端口：

- `ModelRepository`：用户模型元数据发布与版本控制。
- `CodeModelCatalog`：代码内系统模型的只读协议目录。
- `CompiledModelProvider`：运行时模型解析与缓存。
- `RecordReader`：受控数据读取。
- `UnitOfWork`：原子提交 `TransactionPlan`。
- `RecordExpander`：关联展示值展开。
- `OutboxRepository`：提交后事件读取与状态更新。

模型 `database.initialize` 仅获得 `ModelDatabaseContext`，不能访问 Worker Core、D1
或具体 Store。历史结构变更只存在于 D1 migration，不在启动阶段保留兼容分支。

## 协议级可见性

字段的 `private: true` 是服务端私有字段的唯一声明。公开 Schema 和记录响应都必须根据该声明裁剪，任何角色（包括超级管理员）均不能通过普通模型接口读取私有字段。

## Review 要求

修改 `packages/alienbase/src/runtime` 时至少确认：

1. 是否仍是所有模型共用且必须执行的逻辑。
2. 是否引入了具体模型、认证实现或基础设施细节。
3. 是否改变固定执行顺序、权限边界或事务语义。
4. 是否补充了对应的 Core 单元测试和跨模型回归测试。

修改 `apps/alien-worker/src/bootstrap/core.ts` 时还必须确认 AlienBase 端口均由 Worker 侧实现，
并且没有把 D1 binding、SQL 或 Cloudflare 请求上下文泄漏进 `packages/alienbase`。
