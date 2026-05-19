---
pageType: home

hero:
  name: AlienForm
  text: Schema 驱动表单引擎
  tagline: 以真实源码为准的双语文档，覆盖 core、react、ui 与完整协议示例
  image:
    src: /logo.svg
    alt: AlienForm
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: English Docs
      link: /

features:
  - title: Core / React / UI 分层
    details: 文档按真实导出拆分为 headless core、React 绑定层和 UI 组件层，便于从源码到用法逐层理解。
  - title: 协议与实现对齐
    details: `x-reaction`、`x-format`、`x-validate`、`dataSourcePolicy` 等说明均以当前仓库实现为准，不写不存在的能力。
  - title: 每页附真实 Demo
    details: 示例直接来自 apps/demo 中的 schema 场景，并拆分到对应 API 页面，便于边读边对照运行效果。
---

# AlienForm

AlienForm 是面向企业场景的 Schema Form 引擎，当前仓库由三个运行时包组成：

- `@alien-form/core`：表单模型、字段状态、表达式与动态协议执行。
- `@alien-form/react`：React Context、Schema 渲染器、hooks。
- `@alien-form/ui`：默认 UI 组件与布局容器。

## 你会在这里看到什么

- 真实导出清单：只记录 `packages/*/src/index.*` 里当前真的导出的 API。
- 真实行为说明：例如 `SchemaField` 会调用 `form.setSchema()`，`useField()` 会订阅字段变化，`form.values` 会经过 `x-format.output`。
- 真实 demo：文档示例优先复用 `apps/demo` 中的 schema 片段，而不是重新发明一套脱离实现的例子。

## 快速入口

- [快速开始](./guide/getting-started)
- [Core API](./api/core)
- [React API](./api/react)
- [Schema API](./api/schema)
- [Components API](./api/components)
- [联动协议](./advanced/linkage)
- [数组字段](./advanced/array-fields)
- [异步数据源](./advanced/async-datasource)
