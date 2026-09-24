# AlienBase

AlienBase 是 Alien Form 的数据库与平台无关后端运行时。它提供统一的模型执行管道、权限控制和端口契约，但不直接依赖 Hono、Cloudflare Workers 或 D1。

项目通常只需要两个定义入口：

- `defineCore`：定义一个宿主应用的运行时组合根。
- `defineModel`：定义一个代码模型及其受控扩展。

## 快速判断

| 当前要做的事                                           | 使用的 API    |
| ------------------------------------------------------ | ------------- |
| 装配 Repository、权限、模型服务、记录服务和认证服务    | `defineCore`  |
| 把 D1、PostgreSQL 等基础设施实现注入 AlienBase 端口    | `defineCore`  |
| 声明一个模型的 Schema、稳定常量和初始化数据            | `defineModel` |
| 为单个模型增加校验、持久化前逻辑、Command 或事件消费者 | `defineModel` |
| 编写 Hono 路由、中间件、Repository 或普通工具函数      | 两者都不用    |

二者的关系如下：

```text
defineModel() × N
      ↓
模型模块注册表
      ↓
defineCore({ bindings })
      ↓
宿主请求使用的 AlienBase Runtime
```

## defineCore

`defineCore` 定义整个宿主应用如何组装 AlienBase。一个应用通常只有一个 `defineCore` 声明。

```ts
function defineCore<Input, Runtime extends object>(
  factory: (input: Input) => Runtime,
): (input: Input) => Readonly<Runtime>;
```

### 什么时候使用

以下代码应放进 `defineCore` 工厂：

- 根据宿主输入创建数据库 Repository。
- 创建 `CompiledModelProvider`、`AccessControl`、`ModelService` 和 `RecordService`。
- 装配认证、Outbox 派发器等应用级服务。
- 暴露宿主需要调用的运行时能力。

Cloudflare Worker 通常把 D1 binding 作为工厂输入：

```ts
import { AccessControl, ModelService, RecordService, defineCore } from "@alien-form/alienbase";

// create* 函数由宿主实现，负责把 D1 适配器接入 AlienBase 端口。
interface WorkerCoreInput {
  db: D1Database;
}

export const createCore = defineCore(({ db }: WorkerCoreInput) => {
  const modelRepository = createModelRepository(db);
  const recordRepository = createRecordRepository(db);
  const compiledModels = createCompiledModels(modelRepository);
  const access = new AccessControl(createAccessProfileProvider(recordRepository));
  const groups = createModelGroupPolicy(compiledModels, recordRepository);
  const refs = createRecordExpander(db, compiledModels);

  return {
    models: new ModelService(modelRepository, access, compiledModels, groups),
    records: new RecordService(compiledModels, recordRepository, recordRepository, refs, access),
  };
});
```

Hono 中间件在请求作用域内调用工厂：

```ts
const core = createCore({ db: c.env.DB });
c.set("core", core);
```

### 运行时语义

- 工厂每调用一次都会创建新的 Runtime，AlienBase 不缓存请求级对象。
- 返回对象会被浅冻结，并在类型上表现为 `Readonly<Runtime>`。
- 浅冻结只禁止替换 `core.models` 等顶层成员，不会冻结服务实例内部的缓存。
- 数据库连接、平台环境和请求上下文均由宿主传入，AlienBase 不持有这些对象。

### 不应放入 defineCore 的内容

- 具体模型的字段、校验规则或业务命令。
- Hono 路由和 HTTP 输入输出转换。
- SQL 拼接、D1 查询实现或 migration。
- 依赖请求身份的模块级可变状态。

当前项目的完整组合示例见
[`apps/alien-worker/src/bootstrap/core.ts`](../../apps/alien-worker/src/bootstrap/core.ts)。

## defineModel

`defineModel` 定义一个代码模型的完整模块。每个模型通常在自己的 `{modelCode}/index.ts` 中调用一次，并作为默认导出。

```ts
function defineModel<const Module extends ModelModule>(factory: () => ModelModule & Module): Module;
```

### 什么时候使用

模型需要以下任一能力时使用 `defineModel`：

- 提供作为唯一真相源的 `AlienSchema`。
- 声明系统记录 ID 等稳定常量。
- 在模型发布后幂等写入初始化数据。
- 扩展统一 CRUD 生命周期。
- 提供模型专属 Command。
- 消费事务提交后的 Outbox 事件。

```ts
import { defineModel, ensureRecord } from "@alien-form/alienbase";
import createSchema from "./schema.ts";

export default defineModel(() => {
  const constants = {
    code: "_sys_role",
    adminId: "SYSROLE000001",
  } as const;

  return {
    schema: createSchema(constants),
    constants,
    database: {
      async initialize(context) {
        await ensureRecord(
          context,
          constants.code,
          constants.adminId,
          { name: "管理员" },
          "SYSTEM",
        );
      },
    },
    middleware: {
      validate({ record }) {
        if (typeof record.name !== "string" || record.name.trim() === "") {
          throw new Error("角色名称不能为空");
        }
      },
    },
  };
});
```

### ModelModule 能力

| 字段                  | 用途                                                | 约束                         |
| --------------------- | --------------------------------------------------- | ---------------------------- |
| `schema`              | 定义字段、页面、关系和存储协议                      | 必填，是模型协议的唯一真相源 |
| `constants`           | 保存稳定 ID 和模型内部常量                          | 不写入协议或数据库           |
| `database.initialize` | 模型发布后写入种子或初始数据                        | 必须幂等，只能使用受控上下文 |
| `middleware`          | 扩展 `prepare → validate → beforePersist → present` | 不能绕过权限、校验和事务     |
| `commands`            | 表达模型专属业务操作                                | 必须声明权限与允许写入的字段 |
| `events`              | 消费已提交的 Outbox 事件                            | 在业务事务提交后执行         |

`defineModel` 会立即执行工厂并保留返回值的精确类型，因此
`module.constants.adminId` 等字段无需额外声明类型。它不会冻结整个模型模块；运行时会在编译阶段生成不可变的 `CompiledModel`。

### 不应放入 defineModel 的内容

- Hono Context、Request 或 Response。
- D1 binding、原始数据库连接或具体 Repository。
- 跨模型共享的权限执行逻辑。
- 绕过 `RecordService` 直接提交业务写入的代码。
- 必须与领域数据原子提交的外部副作用。

当前项目的完整模型示例见
[`apps/alien-worker/src/models/_sys_role/index.ts`](../../apps/alien-worker/src/models/_sys_role/index.ts)。

## 两个 API 的边界

`defineCore` 决定“系统由哪些实现组成”，`defineModel` 决定“某个模型具备哪些能力”。

当模型需要新的业务行为时，优先增加 `middleware`、`commands` 或 `events`；当应用需要替换数据库、认证实现或运行时服务时，修改 `defineCore` 的装配。不要让模型访问宿主基础设施，也不要让 AlienBase Runtime 硬编码具体模型。
