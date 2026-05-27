# AlienForm

AlienForm 是一个治理优先的 Schema Form 引擎，面向人和 AI 共同编写、审查和长期维护企业表单的场景。

## 核心主张

| 问题 | AlienForm 的选择 |
| --- | --- |
| 字段联动 | 字段属性派生写在 `x-reaction`，不写命令式跨字段修改 |
| 业务异步 | 收口到 `handlers`，不塞进 schema |
| 内部规则 | `createForm({ setup }) + form.effect(...)` |
| 协议表达 | 收敛而非开放，减少隐式行为 |

## 包结构

| 包 | 职责 |
| --- | --- |
| `@alien-form/core` | headless runtime — `createForm`、字段树、联动、校验 |
| `@alien-form/react` | React 绑定 — `useCreateForm`、`FormProvider`、`SchemaField` |
| `@alien-form/ui` | 默认组件实现，可替换 |

## 逻辑归位

```
schema        → 字段结构 + 属性派生（x-reaction / x-format / x-validate）
setup         → 表单内部规则（form.effect）
React         → 视图绑定 + 外部桥接
handlers      → 业务异步实现
```

阅读文档时，先判断逻辑属于哪一层，再选择具体 API。

## 推荐阅读顺序

1. [快速开始](./getting-started) — 建立 `useCreateForm + FormProvider + SchemaField` 基本心智
2. [架构设计](./architecture) — 理解 core / react / ui 分层和 `setup` 的作用
3. [Schema 协议](./schema-protocol) — 理解字段属性派生模型
4. [x-reaction](./advanced/x-reaction) / [x-format](./advanced/x-format) / [x-validate](./advanced/x-validate) — 动态协议
5. [开发范式](/zh/patterns/edit-initialization) — 企业场景的推荐写法

需要查方法签名时回到 [API 参考](/zh/api/core/form)。
