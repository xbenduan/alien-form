# AlienForm

<p align="center">
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-18181B?style=flat-square"></a>
  <img alt="typescript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="react" src="https://img.shields.io/badge/React-18%2F19-149ECA?style=flat-square&logo=react&logoColor=white">
  <img alt="monorepo" src="https://img.shields.io/badge/Monorepo-pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white">
  <img alt="status" src="https://img.shields.io/badge/status-pre--release-6B7280?style=flat-square">
</p>

<p align="center">
  一个面向企业场景的 Schema Form 引擎，基于 <code>alien-signals</code> 构建，强调协议收敛、边界清晰、可审计与低心智负担。
</p>

---

AlienForm 借鉴了成熟 Schema Form 的分层思想，但目标不是兼容既有方案，而是围绕下面几个原则重新设计一套更克制的实现：

- 让 schema 专注于声明结构与规则，而不是承载混乱的控制流
- 让 core 专注于状态、协议执行和响应式依赖，而不是耦合 UI 与网络
- 让 React 只是绑定层，而不是模型层的一部分
- 让副作用走 `setup + effect`，而不是继续堆叠事件式 `onXxx` API

如果你想找的是一个 headless、可扩展、适合业务治理和长期维护的表单内核，这个仓库就是为此而建。

## 目录

- [为什么是 AlienForm](#为什么是-alienform)
- [核心特性](#核心特性)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [最小示例](#最小示例)
- [设计原则](#设计原则)
- [学习路径](#学习路径)
- [开发命令](#开发命令)
- [文档导航](#文档导航)
- [贡献建议](#贡献建议)

## 为什么是 AlienForm

很多 Schema Form 项目发展到后期都会遇到类似问题：

- 协议层不断膨胀，开始同时描述条件、动作、目标字段和副作用
- 异步加载、接口调用、权限判断混进 schema，边界越来越模糊
- 模型层、渲染层、UI 层相互耦合，替换与维护成本越来越高
- 新人很难快速回答“问题属于哪一层”“应该改哪里”

AlienForm 的解法是把这些复杂度主动拆开：

- `@alien-form/core` 只做 headless form model、字段树、协议执行、校验与数组能力
- `@alien-form/react` 只做 React 绑定与 schema 递归渲染
- `@alien-form/ui` 只是默认 UI 组件实现，不反向限制协议能力
- 复杂业务逻辑通过 `handlers` 和 `setup + effect` 注入，而不是塞进 schema DSL

这不是一个“大而全”的表单平台，而是一个刻意控制边界的表单内核。

## 核心特性

- `alien-signals` 驱动：form 和 field 都建立在响应式依赖追踪之上
- Headless core：状态模型与渲染层解耦，UI 与宿主框架可替换
- 收敛的协议层：围绕 `x-reaction`、`x-format`、`x-validate` 组织动态能力
- 统一副作用模型：通过 `setup + form.effect(...)` 描述联动与外部桥接
- 安全表达式运行时：对表达式能力做边界控制，降低注入和误用风险
- 数组与复杂场景支持：内置数组字段树、嵌套数组、SKU 矩阵等典型企业场景
- React 标准化集成：`FormProvider`、`SchemaField`、hooks 语义尽量贴近 React 直觉
- StrictMode 友好：外部 form 默认不会在 Provider 卸载时被误销毁

## 项目结构

这是一个基于 `pnpm workspace` 的 monorepo：

```text
.
├── apps
│   ├── demo                    # 示例应用
│   └── docs                    # 文档站点
├── packages
│   ├── core                    # 核心模型、协议执行、表达式与校验
│   ├── react                   # React 绑定层
│   └── ui                      # 默认 UI 组件实现
├── docs
│   └── core-signals-api-redesign.md
├── README.md
├── package.json
└── pnpm-workspace.yaml
```

### Packages

| Package | 说明 |
| --- | --- |
| `@alien-form/core` | 无头表单内核，负责 `createForm`、`IForm`/`IField` 契约、字段树、联动、校验、数组与运行时协议 |
| `@alien-form/react` | React 绑定层，提供 `FormProvider`、`SchemaField` 和常用 hooks |
| `@alien-form/ui` | 默认 UI 组件集，供 demo 和快速集成使用 |

### Apps

| App | 说明 |
| --- | --- |
| `apps/demo` | 实际运行中的协议样例，适合快速理解能力边界 |
| `apps/docs` | Rspress 文档站，包含设计说明、API 和模式文档 |

## 快速开始

### 环境要求

- Node.js `18+`
- `pnpm`

### 安装依赖

```bash
pnpm install
```

### 启动示例应用

```bash
pnpm dev
```

### 启动文档站

```bash
pnpm dev:docs
```

### 运行测试

```bash
pnpm test
```

如果你只想验证 core：

```bash
pnpm test:core
```

## 最小示例

下面的例子展示了 AlienForm 的核心使用方式：schema 描述结构，React 负责渲染，`setup + effect` 负责复杂联动。

```tsx
import React from "react";
import { createForm, FormProvider, SchemaField } from "@alien-form/react";

const form = createForm({
  initialValues: {
    type: "person",
  },
  setup: (instance) => {
    return instance.effect(
      (current) => current.getField("type")?.value,
      (type) => {
        instance.setFieldState("name", (state) => {
          state.title = type === "company" ? "企业名称" : "姓名";
        });
      },
      { immediate: true },
    );
  },
});

const components = {
  Input: ({ value, onChange, ...rest }: any) => (
    <input
      {...rest}
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
  Select: ({ value, onChange, dataSource = [], ...rest }: any) => (
    <select
      {...rest}
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
    >
      {dataSource.map((item: any) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
  FormItem: ({ title, children }: any) => (
    <label style={{ display: "grid", gap: 8 }}>
      <span>{title}</span>
      {children}
    </label>
  ),
};

const decorators = {
  FormItem: components.FormItem,
};

const schema = {
  type: "object",
  properties: {
    type: {
      type: "string",
      title: "类型",
      component: "Select",
      decorator: "FormItem",
      dataSource: [
        { label: "个人", value: "person" },
        { label: "企业", value: "company" },
      ],
    },
    name: {
      type: "string",
      title: "姓名",
      component: "Input",
      decorator: "FormItem",
    },
  },
} as const;

export function App() {
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
    </FormProvider>
  );
}
```

这个例子对应的思路很简单：

- `createForm()` 创建 headless form 实例
- `SchemaField` 根据 schema 递归渲染字段树
- `components` / `decorators` 负责把统一协议映射到具体 UI
- `setup + effect` 负责不适合写进 schema 的复杂副作用
- React 项目通常只需要依赖 `@alien-form/react`；它已经重导出了 `createForm` 和常用 core 类型

## 设计原则

### 1. 先分层，再扩展

AlienForm 的分层是明确的：

```text
schema protocol
      |
      v
@alien-form/core
      |
      v
@alien-form/react
      |
      v
@alien-form/ui
      |
      v
apps/demo / apps/docs
```

这意味着：

- core 可以脱离 UI 独立演进
- React 只是绑定层，不承载业务模型
- UI 只是实现，不定义协议边界
- demo 与 docs 是正式学习入口，而不是散落的隐性知识

### 2. 协议必须收敛

AlienForm 不鼓励 schema 变成迷你流程引擎。动态能力统一围绕字段自己的属性派生展开，例如：

- 当前字段的 `title` 怎么来
- 当前字段的 `props` 怎么来
- 当前字段的 `dataSource` 怎么来
- 当前字段的 `display`、`pattern`、`required` 怎么来

而不是：

- 条件 A 成立
- 去改字段 B
- 触发动作 C
- 执行副作用 D

这种设计能让 schema 更易审计，也更适合长期维护。

### 3. 规则类型故意很少

`x-reaction`、`x-format`、`x-validate` 统一使用少量规则类型：

- `static`
- `expression`
- `match`
- `computed`

少，不是能力弱，而是为了避免协议层继续膨胀。

### 4. 副作用走 effect，不走事件总线

AlienForm 当前统一使用 `setup + form.effect(...)` 描述外部桥接与复杂联动：

- 更符合 `alien-signals` 的依赖追踪模型
- 更贴近 React 和 signals 生态的心智
- 避免 `onFieldChange` 这类路径事件模型在聚合值场景下的语义割裂

### 5. 异步边界必须可预期

- `x-format` 只做同步值转换
- `x-reaction` 可以处理异步派生与 loading
- `x-validate` 支持同步和异步校验
- 网络请求、鉴权、缓存策略交给业务 `handlers`

## 学习路径

如果你第一次进入这个仓库，推荐按下面顺序理解：

### 1. 先跑 demo

先执行 `pnpm dev`，建立“schema 长什么样、页面怎么渲染出来”的直觉。

### 2. 看 demo 的真实接入方式

优先阅读：

- `apps/demo/src/schema`
- `apps/demo/src/components/schema-renderer.tsx`
- `apps/demo/src/utils/sku-matrix.ts`

### 3. 看文档中的协议说明

优先阅读：

- [中文快速开始](./apps/docs/docs/zh/guide/getting-started.md)
- [架构总览](./apps/docs/docs/zh/guide/architecture.md)
- [Schema Protocol](./apps/docs/docs/zh/guide/schema-protocol.md)
- [SKU 矩阵模式](./apps/docs/docs/zh/patterns/spec-sku-matrix.md)

### 4. 再深入 core 与 react

优先阅读：

- `packages/react/src/index.tsx`
- `packages/core/src/engine/form/index.ts`
- `packages/core/src/engine/field/index.ts`
- `packages/core/src/schema/types.ts`
- `packages/core/src/engine/runtime/reaction.ts`

### 5. 最后用测试确认行为边界

重点测试文件：

- `packages/core/src/__tests__/core.test.ts`
- `packages/react/src/__tests__/binding.test.tsx`
- `packages/react/src/__tests__/twice-strict.test.tsx`

## 开发命令

```bash
pnpm dev             # 启动 demo
pnpm dev:docs        # 启动文档站
pnpm build           # 构建所有包和应用
pnpm test            # 运行全部测试
pnpm test:core       # 只运行 core 测试
pnpm lint            # 运行 oxlint
pnpm format:check    # 检查代码格式
```

## 文档导航

### Guides

- [为什么是 AlienForm](./apps/docs/docs/zh/guide/why-alienform.md)
- [快速开始](./apps/docs/docs/zh/guide/getting-started.md)
- [架构说明](./apps/docs/docs/zh/guide/architecture.md)
- [Schema Protocol](./apps/docs/docs/zh/guide/schema-protocol.md)

### APIs

- [FormConfig](./apps/docs/docs/zh/api/core/form-config.md)
- [Form](./apps/docs/docs/zh/api/core/form.md)
- [Field](./apps/docs/docs/zh/api/core/field.md)
- [React FormProvider](./apps/docs/docs/zh/api/react/form-provider.md)
- [React SchemaField](./apps/docs/docs/zh/api/react/schema-field.md)
- [React Hooks](./apps/docs/docs/zh/api/react/hooks.md)

### Patterns

- [异步数据](./apps/docs/docs/zh/patterns/async-data.md)
- [复合字段](./apps/docs/docs/zh/patterns/composite-fields.md)
- [编辑态初始化](./apps/docs/docs/zh/patterns/edit-initialization.md)
- [规格 SKU 矩阵](./apps/docs/docs/zh/patterns/spec-sku-matrix.md)

## 贡献建议

如果你准备开始改代码，下面是最有效的入口：

- 想改协议定义：先看 `packages/core/src/schema/types.ts`
- 想改联动或 effect 行为：先看 `packages/core/src/engine/form/index.ts`
- 想改数组字段树：先看 `packages/core/src/engine/field/index.ts`
- 想改 React 渲染：先看 `packages/react/src/index.tsx`
- 想改默认 UI：先看 `packages/ui/src/components`
- 想补 demo 场景：先看 `apps/demo/src/schema`
- 想补行为边界：优先补 `packages/core` 和 `packages/react` 的测试

## 当前状态

- 当前仓库仍处于 pre-release 阶段
- API 正在围绕 `setup + effect` 和收敛后的 schema 协议持续打磨
- 如果你关心近期设计演进，可以阅读 [core-signals-api-redesign.md](./docs/core-signals-api-redesign.md)

---

> AlienForm 的核心不是“把所有能力都塞进 schema”，而是“把 schema、运行时、渲染层和业务副作用的边界划清楚”。
