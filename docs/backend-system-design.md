# Alien Worker 后端系统设计

## 架构定位

后端采用模块化单体与六边形架构。协议是唯一真相源，运行时只执行协议编译后的约束和模型模块声明的受控扩展。

依赖方向固定为：

```text
HTTP / Container / Auth / Models
              ↓
             Core
              ↓
       Store / Storage Ports
```

## Core 边界

`apps/alien-worker/src/services/core` 是所有模型共用且不可绕过的执行内核。该目录的修改属于高风险变更，必须重点审查执行顺序、权限边界、事务一致性和跨模型回归。

Core 仅包含：

- 模型定义发布与版本控制。
- 记录读写的统一执行管道。
- 模型中间件生命周期调度。
- 协议级记录校验与可见性。
- Core 所需的端口契约。

Core 不允许：

- 导入 `services/models/*` 中的具体模型。
- 硬编码模型名、字段名或系统记录 ID。
- 承担登录、会话或角色解析等认证域实现。
- 承担启动编排、种子数据或模型构造工具。
- 允许模型扩展绕过权限、校验、事务或持久化流程。

## 职责分层

| 目录或文件                       | 职责                                               |
| -------------------------------- | -------------------------------------------------- |
| `services/core/`                 | 所有模型必经的执行内核、权限决策和端口             |
| `services/auth/`                 | 登录、会话，以及用户和角色到权限档案的解析         |
| `services/models/{modelCode}/`   | 单个代码模型的协议、数据库初始化和受控生命周期扩展 |
| `services/bootstrap.ts`          | 按约定装配、发布并初始化代码模型                   |
| `services/model-group-policy.ts` | 用系统分类模型实现 Core 的模型分组端口             |
| `utils/system-model.ts`          | 构造系统模型协议的纯工具                           |
| `container.ts`                   | 组合根，负责把具体实现注入 Core 端口               |

权限职责进一步拆分为：

```text
auth/RoleAccessProfileProvider
  用户与角色模型 → AccessProfile
                     ↓
core/AccessControl
  操作授权、数据范围、字段与 Schema 裁剪
```

`AccessControl` 属于 Core，并由 `ModelService` 与 `RecordService` 强制调用。
`RoleAccessProfileProvider` 属于 Auth，只负责读取具体身份与角色模型，不参与权限决策。

## 执行约束

写操作固定经过以下阶段：

```text
解析 → 鉴权 → prepare → 归一化 → validate → beforePersist
    → 事务持久化 → Outbox → 提交 → afterCommit → present
```

模型只能通过固定生命周期扩展行为：

- `prepare`
- `validate`
- `beforePersist`
- `afterCommit`
- `present`

每个模型每个阶段最多一个处理函数。模型扩展不得自行提交事务、跳过权限检查或直接执行外部副作用。

## 协议级可见性

字段的 `private: true` 是服务端私有字段的唯一声明。公开 Schema 和记录响应都必须根据该声明裁剪，任何角色（包括超级管理员）均不能通过普通模型接口读取私有字段。

## Review 要求

修改 `services/core` 时至少确认：

1. 是否仍是所有模型共用且必须执行的逻辑。
2. 是否引入了具体模型、认证实现或基础设施细节。
3. 是否改变固定执行顺序、权限边界或事务语义。
4. 是否补充了对应的 Core 单元测试和跨模型回归测试。
