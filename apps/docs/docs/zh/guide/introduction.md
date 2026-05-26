# 简介

AlienForm 是一套面向企业场景的 Schema Form 运行时，目标不是只把表单“渲染出来”，而是把表单里的几个核心问题拆清楚：

- 值树由谁管理
- 字段实例由谁管理
- 联动逻辑应该写在 schema、core 还是 React
- 业务异步能力应该放在协议里还是放在外部 handler

当前项目的基本范式是：

- `@alien-form/core` 负责 headless runtime，公开 `createForm`、`IForm`、`IField`
- `@alien-form/react` 负责 React 绑定，作为 React 项目的主要入口
- `@alien-form/ui` 只提供默认组件实现，不定义协议边界

## 为什么需要这套分层

表单复杂起来以后，真正困难的不是“有没有输入框”，而是：

- 字段之间如何联动，而且逻辑还能被读懂
- 表单值如何和接口值结构解耦
- 异步请求、权限、缓存、埋点这些业务能力如何接入而不污染 core
- 文档、示例和运行时心智能否长期保持一致

AlienForm 选择用一套更收敛的模型来回答这些问题：

- `createForm()` 创建长期存活的 `IForm` 运行时对象
- `form.getField(path)` 返回 `IField`，字段实例负责局部状态
- `SchemaField` 把 schema 应用到 form 并递归渲染字段树
- 复杂内部规则优先放在 `createForm({ setup })` 中，通过 `form.effect(...)` 驱动
- 远程数据和业务副作用通过 `handlers` 注入，而不是硬塞进 schema DSL

## 文档结构

本文档分为两层：

- `Guide`：解释问题域、架构边界和推荐范式
- `API`：描述真实公开契约、方法签名和行为边界

阅读 Guide 时，重点是建立“逻辑归位”的判断标准：

- schema 负责声明结构和字段属性派生
- `setup` 负责表单内部规则
- React 负责视图绑定和外部桥接
- `handlers` 负责业务异步实现

## 包结构映射

| 包名 | 职责 |
| --- | --- |
| `@alien-form/core` | headless form runtime，负责 `createForm`、字段树、规则执行、校验、数组能力 |
| `@alien-form/react` | React 上下文、hooks、`FormProvider`、`SchemaField` |
| `@alien-form/ui` | 默认组件、布局组件、数组表现层 |

## 推荐阅读顺序

1. 先看 [快速开始](./getting-started)，建立 `useCreateForm + FormProvider + SchemaField` 的基本心智。
2. 再看 [架构设计](./architecture)，理解 `core / react / ui` 三层边界。
3. 接着读 [Schema 协议](./schema-protocol) 和 [x-reaction](./advanced/x-reaction)，理解字段属性派生模型。
4. 需要查契约时，回到 [API / Core / Form](/api/core/form)、[API / Core / Field](/api/core/field)、[API / React / Hooks](/api/react/hooks)。
