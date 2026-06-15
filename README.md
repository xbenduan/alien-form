<p align="center">
  <span style="font-size: 72px;">👽</span>
</p>

<h1 align="center">AlienForm</h1>

<p align="center">
  <strong>Schema-Driven Form & CMS Runtime for complex business applications.</strong>
</p>

<p align="center">
  用一份可执行 Schema 描述字段结构、交互逻辑、校验规则、数据格式化、场景渲染和 CMS 元信息。
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
  <a href="./package.json"><img alt="Node" src="https://img.shields.io/badge/node-%3E%3D18.0.0-339933.svg" /></a>
  <a href="./pnpm-workspace.yaml"><img alt="Package Manager" src="https://img.shields.io/badge/pnpm-9.15.0-F69220.svg" /></a>
  <a href="./packages/core/README.md"><img alt="Core" src="https://img.shields.io/badge/core-headless-7C3AED.svg" /></a>
  <a href="./packages/react/README.md"><img alt="React" src="https://img.shields.io/badge/react-18%20%7C%2019-61DAFB.svg" /></a>
  <a href="./packages/cms/README.md"><img alt="CMS" src="https://img.shields.io/badge/cms-provider%20driven-111827.svg" /></a>
</p>

<p align="center">
  <a href="#-为什么做-alienform">为什么做</a>
  ·
  <a href="#-核心能力">核心能力</a>
  ·
  <a href="#-快速开始">快速开始</a>
  ·
  <a href="#-包目录">包目录</a>
  ·
  <a href="./packages/core/README.md">Core</a>
  ·
  <a href="./packages/react/README.md">React</a>
  ·
  <a href="./packages/cms/README.md">CMS</a>
</p>

---

AlienForm 不是又一个表单组件库，而是一套把“表单行为”从 UI 组件中抽离出来的运行时协议。
它让业务可以先用 Schema 描述领域模型，再按需接入 React、CMS 管理台、远程后端或自己的渲染系统。

## ✨ 一眼看懂

| 能力 | 说明 |
| --- | --- |
| 🧠 Headless Runtime | `@alien-form/core` 只负责字段树、状态、联动、校验、格式化和提交投影，不绑定 UI。 |
| ⚛️ React Binding | `@alien-form/react` 提供 Hook、Provider、Signal 订阅和 Schema 自动渲染。 |
| 🧩 CMS Toolkit | `@alien-form/cms` 提供模型 Schema、Provider、CRUD API、表格/筛选/详情投影和 Builder 工具。 |
| 🔁 Scene-Driven UI | 同一份 Schema 可以投影到新增、编辑、详情、表格、筛选和移动端卡片等场景。 |
| 🔌 Provider Oriented | 本地内存 Demo 与远程 REST 后端使用同一套 Provider 契约。 |
| 🛡️ Restricted Expression | 表达式运行时避免 `eval` / `new Function`，用受限语法承载安全的字段联动。 |

## 📚 目录

- [为什么做 AlienForm](#-为什么做-alienform)
- [核心能力](#-核心能力)
- [适合什么场景](#-适合什么场景)
- [包目录](#-包目录)
- [应用目录](#-应用目录)
- [快速开始](#-快速开始)
- [最小示例](#-最小示例)
- [Schema 协议概览](#-schema-协议概览)
- [架构分层](#-架构分层)
- [子包导读](#-子包导读)
- [开发命令](#-开发命令)

## 💡 为什么做 AlienForm

在真实业务系统里，表单通常不是几个输入框的集合，而是一组会不断演化的业务契约：

- 字段之间有联动：一个字段改变后，另一个字段的显隐、选项、必填、禁用状态会随之变化。
- 同一个模型要出现在多个场景：新增、编辑、详情、表格、筛选、移动端卡片都需要同一份字段语义。
- 后台模型会增长：简单 CRUD 会逐渐发展成可配置模型、远程数据源、权限、数据投影和低代码搭建。
- UI 框架会变化：业务不应该因为 React、Ant Design 或某个组件库变化而重写领域规则。

AlienForm 的立意是：把这些易碎的隐性约定沉淀成一份清晰、可测试、可组合的 Schema Runtime。

## 🚀 核心能力

- **Headless First**：`@alien-form/core` 不依赖 React，不关心组件库，只负责字段树、状态、校验、联动和提交投影。
- **Schema As Contract**：Schema 同时是表单结构、运行时规则、CMS 模型和跨场景渲染的单一事实来源。
- **Runtime Value Model**：表达式、handler、函数和字面量共享同一套运行时值协议，避免分裂的 DSL。
- **Scene-Driven UI**：CMS 场景下，组件通过 meta 声明自己在表单、详情、表格、筛选中的渲染策略。
- **Provider Oriented**：CMS 数据访问通过 Provider 抽象，既能本地内存 Demo，也能连接远程 REST 后端。
- **Composable Packages**：你可以只使用核心表单运行时，也可以组合 React 绑定和 CMS 能力构建完整后台。

## 🎯 适合什么场景

- 中后台表单、动态表单、低代码/零代码表单搭建器。
- Schema 驱动的 CRUD、模型管理、记录管理、配置后台。
- 字段联动复杂、校验复杂、需要输入/输出格式化的业务表单。
- 希望 UI 组件、业务规则和数据 Provider 解耦的前端架构。
- 需要把同一份模型投影到编辑、详情、列表、筛选等多个场景的管理系统。

## 📦 包目录

| Package | Role | Documentation |
| --- | --- | --- |
| 🧠 `@alien-form/core` | 无头表单运行时，负责 Schema 解析、字段树、Signal 状态、联动、校验和提交投影。 | [`packages/core`](./packages/core/README.md) |
| ⚛️ `@alien-form/react` | React 绑定层，提供 `useCreateForm`、`FormProvider`、`SchemaField` 和字段状态 Hooks。 | [`packages/react`](./packages/react/README.md) |
| 🧩 `@alien-form/cms` | CMS 核心能力，提供模型 Schema、Provider、CRUD API、场景投影和 Builder 工具函数。 | [`packages/cms`](./packages/cms/README.md) |

## 🏗️ 应用目录

| App | Role |
| --- | --- |
| 🖥️ `apps/alien-cms` | 基于三个包组合出的本地 CMS 工作台，用于模型管理、记录管理和运行时验证。 |
| ☁️ `apps/server-cloudflare` | 面向 Cloudflare Workers 的后端示例，提供 Schema、Record、Log、Auth 等 API。 |
| 📖 `apps/docs` | 文档站目录。 |

## ⚡ 快速开始

```bash
pnpm install
pnpm dev
```

默认开发命令会启动 `apps/alien-cms`：

```bash
pnpm --filter @alien-form/alien-cms run dev
```

构建与测试：

```bash
pnpm build
pnpm test
pnpm lint
```

## 🧪 最小示例

```ts
import { createForm } from "@alien-form/core";

const form = createForm({
  schema: {
    type: "object",
    properties: {
      role: {
        type: "string",
        title: "角色",
        component: "Select",
        dataSource: [
          { label: "管理员", value: "admin" },
          { label: "普通用户", value: "user" },
        ],
      },
      permissions: {
        type: "string",
        title: "权限",
        component: "Select",
        dataSourcePolicy: "first",
        "x-reaction": {
          display: "{{ role ? 'visible' : 'none' }}",
          dataSource: "{{ role === 'admin' ? [{ label: '全部', value: '*' }] : [{ label: '读取', value: 'read' }] }}",
        },
      },
    },
  },
  initialValues: {
    role: "user",
  },
});

form.mount();
form.set("role", "admin");

const values = await form.submit();
```

如果你使用 React，可以把同一份 Schema 交给 `@alien-form/react` 渲染：

```tsx
import { FormProvider, SchemaField, useCreateForm } from "@alien-form/react";

function App() {
  const form = useCreateForm({ schema }, [schema]);

  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField />
    </FormProvider>
  );
}
```

## 📝 Schema 协议概览

AlienForm 的 Schema 基于对象树描述字段，并增加少量运行时扩展：

| 字段 | 作用 |
| --- | --- |
| `type` | 字段类型，支持 `string`、`number`、`boolean`、`object`、`array`、`void` 以及自定义类型。 |
| `component` / `props` | 指定渲染组件和组件参数。 |
| `decorator` / `decoratorProps` | 指定字段装饰器，例如表单项容器。 |
| `required` | 必填 UI 状态和内置必填校验简写。 |
| `dataSource` | 选项数据源。 |
| `dataSourcePolicy` | 选项变化后当前值的处理策略：`preserve`、`clear`、`filter`、`first`。 |
| `definitions` / `$ref` | `schema.definitions` 是 `$ref` 引用字典；`config.definitions` 会合并到该字典，只有 schema 显式 `$ref` 时才生效。 |
| `x-reaction` | 字段联动规则，可派生值、显隐、禁用、选项、组件、标题等。 |
| `x-effect` | 字段挂载后的副作用规则。 |
| `x-format` | 输入初始化与输出提交的格式化规则。 |
| `x-validate` | 自定义校验规则。 |
| `x-cms` | CMS 场景元信息，描述表格、筛选、表单、详情、移动端等投影行为。 |

运行时值统一支持：

- 字面量：`"text"`、`100`、`true`、`{}`、`[]`。
- 表达式：`"{{ role === 'admin' ? 'visible' : 'none' }}"`。
- Handler 引用：`"@loadOptions"`。
- 直接函数：`(ctx, form) => any`。
- 运行时值数组：用于组合多个规则。

更完整的运行时协议见 [`@alien-form/core`](./packages/core/README.md)。

## 🧭 架构分层

```text
┌────────────────────────────────────────────────────────────┐
│ apps/alien-cms                                             │
│ CMS workbench, model builder, record management             │
└───────────────┬───────────────────────────────┬────────────┘
                │                               │
┌───────────────▼──────────────┐   ┌────────────▼────────────┐
│ @alien-form/react             │   │ @alien-form/cms          │
│ React hooks and schema render │   │ providers and projection │
└───────────────┬──────────────┘   └────────────┬────────────┘
                │                               │
                └───────────────┬───────────────┘
                                │
                   ┌────────────▼────────────┐
                   │ @alien-form/core         │
                   │ headless form runtime    │
                   └─────────────────────────┘
```

## 🧱 子包导读

- 想理解字段树、联动、校验、格式化、表达式和提交投影：阅读 [`packages/core/README.md`](./packages/core/README.md)。
- 想在 React 中渲染 Schema、订阅字段状态、接入自己的组件库：阅读 [`packages/react/README.md`](./packages/react/README.md)。
- 想做模型管理、记录 CRUD、本地/HTTP Provider、表格/筛选投影：阅读 [`packages/cms/README.md`](./packages/cms/README.md)。
- 想理解 CMS 的场景驱动组件设计：阅读 [`docs/scene-driven-architecture.zh-CN.md`](./docs/scene-driven-architecture.zh-CN.md)。

## 🛠️ 开发命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动 Alien CMS 本地开发应用。 |
| `pnpm build` | 构建全部 workspace 包和应用。 |
| `pnpm test` | 运行全部测试。 |
| `pnpm test:core` | 只运行 `@alien-form/core` 测试。 |
| `pnpm build:core` | 只构建 `@alien-form/core`。 |
| `pnpm build:react` | 只构建 `@alien-form/react`。 |
| `pnpm lint` | 运行 Oxlint。 |
| `pnpm format` | 使用 Oxfmt 格式化项目。 |

## 🚧 项目状态

AlienForm 当前处于快速演进阶段，核心运行时、React 绑定和 CMS 抽象已经具备可组合能力。
如果你准备在生产环境中使用，建议优先锁定 Schema 协议和包版本，并用项目内测试覆盖关键业务 Schema。

## 📄 License

[MIT](./LICENSE)
