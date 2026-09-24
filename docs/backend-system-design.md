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

- 模型定义发布与版本控制。
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
| `packages/alienbase/src/define-core.ts`           | 保留完整类型推导的项目级 Core 工厂                 |
| `packages/alienbase/src/define-model.ts`          | 数据库无关的模型模块与初始化上下文                 |
| `apps/alien-worker/src/bootstrap/core.ts`         | Worker 唯一组合根与 isolate 初始化协调器           |
| `apps/alien-worker/src/application/`              | 认证、编译模型注册、模型策略与 Outbox 派发         |
| `apps/alien-worker/src/models/`                   | 代码模型的协议、初始化、生命周期、Command 和消费者 |
| `apps/alien-worker/src/adapters/d1/compiler/`     | D1 存储计划、查询表达式与协议编译                  |
| `apps/alien-worker/src/adapters/d1/repositories/` | AlienBase 端口与会话端口的 D1 实现                 |
| `apps/alien-worker/src/http/`                     | Hono 应用、路由、中间件、输入输出适配              |
| `apps/alien-worker/src/index.ts`                  | Cloudflare Worker 最小入口                         |

Worker 为每个请求通过 `createCore({ db })` 创建独立运行时，不跨请求共享请求态对象。
模型发布与种子数据初始化由 `initializeCore` 在每个 isolate 内只成功执行一次：首批并发
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
解析 → 鉴权 → prepare → 归一化 → validate → beforePersist
    → TransactionPlan（记录变更 + 领域事件）
    → D1 batch 原子提交（业务表 + Outbox）→ present
```

模型只能通过固定生命周期扩展行为：

- `prepare`
- `validate`
- `beforePersist`
- `present`

每个模型每个阶段最多一个处理函数。`beforePersist` 只能通过 `EventCollector`
追加事件，不能自行提交事务或直接执行外部副作用。

模型专属业务使用声明式 `commands`。Command 必须声明操作权限和允许写入的字段，
返回 mutation 与 event，由同一条记录执行管道再次完成字段鉴权、生命周期和协议校验。
HTTP 入口统一为 `POST /api/v1/records/:model/actions/:command`。

## 编译与缓存

协议发布后，`CompiledModels` 按 `model@version` 编译并缓存以下不可变计划：

- 存储表、字段、索引与关系计划。
- 查询字段表达式及过滤、排序能力。
- 公私字段策略。
- 校验字段映射。
- 代码模型声明的生命周期、Command 和事件消费者。

读写服务、鉴权身份解析、引用展开和模型策略只接收 `CompiledModelProvider`，
不会在请求路径中重复解释协议。模型发布后必须使该模型的缓存失效。

## 事务与事件

D1 不提供跨任意异步逻辑的交互式事务。本系统先完成读取、鉴权、生命周期与校验，
再生成完整 `TransactionPlan`，由 `D1RecordRepository.commit()` 将所有业务 SQL 和 Outbox
写入合并为一次 `D1Database.batch()`。任一语句失败时，整批操作回滚。

提交后，Worker 使用 `executionCtx.waitUntil()` 调用 `OutboxDispatcher`。消费者成功后
写入 `processed_at`；失败则增加 `attempts` 并保存 `last_error`，供后续请求重试。
因此外部副作用不阻塞事务，也不会在业务提交前执行。

## 端口边界

AlienBase Runtime 只能依赖 `packages/alienbase/src/runtime/contracts.ts` 中定义的端口：

- `ModelRepository`：模型元数据发布与版本控制。
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
