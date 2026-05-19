# AlienForm

AlienForm 是一个面向企业场景的 Schema Form 引擎。它借鉴了 Formily 的设计思想，但目标不是兼容 Formily，而是围绕“可审计、可治理、低心智负担、易扩展”重新设计一套更收敛的协议和实现。

这个仓库不只是一个 npm 包，而是一套完整的工程样板：

- `@alien-form/core` 负责无头表单模型、字段树、联动、校验和协议执行
- `@alien-form/react` 负责把 core 接入 React，并递归渲染 schema
- `@alien-form/ui` 提供 demo 默认使用的通用 UI 组件
- `apps/demo` 用来演示协议能力和真实运行链路
- `apps/docs` 用来沉淀设计说明、API 和使用文档

如果你第一次接触这个项目，推荐先看“为什么这样设计”，再看“从零开始如何理解这个仓库”。

## 这个项目解决什么问题

很多 Schema Form 方案在能力不断叠加后，会逐渐出现这些问题：

- 协议层同时承载条件、动作、目标字段、脚本，难读也难审计
- 业务异步、副作用、接口调用混进 schema，边界变得模糊
- 模型层、渲染层、UI 层耦合在一起，替换成本高
- 新人进入项目时，很难快速判断“先看哪一层”

AlienForm 的思路是把这些问题拆开：

- 用无头 core 只负责表单状态与协议执行
- 用 React 绑定层负责渲染，不侵入核心模型
- 用业务注册的 `handlers` 承接异步和副作用，而不是把这些逻辑塞进 schema
- 用收敛后的协议降低理解和维护成本

## 为什么这样设计

### 1. 先分层，再谈扩展

仓库采用典型的 headless 分层：

```text
schema protocol
      |
      v
@alien-form/core
  - Form / Field
  - x-reaction / x-format / x-validate
  - validation
  - array operations
      |
      v
@alien-form/react
  - FormProvider
  - SchemaField
  - useForm / useField / useArrayField
      |
      v
@alien-form/ui
  - Input / Select / FormItem / ArrayCards ...
      |
      v
apps/demo / apps/docs
```

这样拆分有几个直接好处：

- core 可以脱离 UI 和框架独立演进
- React 只是绑定层，未来可以替换别的渲染宿主
- UI 只是示例实现，不会反向限制协议能力
- demo 和 docs 成为学习入口，而不是散落在代码里的隐性知识

### 2. 协议必须收敛，不能无限膨胀

AlienForm 最关键的设计取舍，是把动态能力集中到字段自己的 `x-reaction` 上，并且只描述“当前字段某个属性如何被派生”。

也就是说，它不是这种思路：

- 如果条件 A 成立
- 就去改字段 B
- 再触发动作 C
- 最后执行副作用 D

而是这种思路：

- 当前字段的 `title` 怎么来
- 当前字段的 `props` 怎么来
- 当前字段的 `dataSource` 怎么来
- 当前字段的 `display` / `pattern` / `required` 怎么来

这就是为什么项目强调单层协议，而不是条件 + 分支 + 动作 + 目标字段的双层控制协议。

这样设计的价值是：

- schema 更容易审计，因为“谁改谁”非常清晰
- 变更范围更可控，不容易出现跨字段联动失控
- 新人读到一个字段时，可以在本地把它的行为闭环理解完

### 3. 内置规则类型故意很少

`x-reaction`、`x-format`、`x-validate` 共用同一种 rule 外壳，内置只支持 4 种类型：

- `static`
- `expression`
- `match`
- `computed`

这不是能力不足，而是刻意控制协议复杂度。

设计含义如下：

- `static` 解决固定值派发
- `expression` 解决轻量同步表达式派生
- `match` 解决枚举式映射
- `computed` 解决需要业务参与的计算逻辑

一旦把大部分复杂需求都收口到 `computed + handlers`，core 就能保持简洁，而业务层也保有足够的扩展空间。

### 4. 异步和副作用不放进 core

core 不内置 URL 获取、鉴权、缓存和具体请求策略。异步数据加载要由业务自己通过 `handlers` 注册，然后在 `computed` 规则中引用。

这是一个很重要的边界：

- core 负责定义调用时机和上下文
- 业务负责定义“去哪里拿数据、怎么鉴权、怎么缓存、失败后怎么办”

这样做的原因很简单：

- 不同业务场景的远程依赖策略差异巨大
- 一旦 core 内置网络语义，很快会变成一个耦合过重的平台层
- 企业项目真正需要的是边界清晰，而不是“大而全”

### 5. 同步链路和异步链路必须可预期

AlienForm 明确区分了三个阶段：

- `x-format` 是同步值转换链路
- `x-reaction` 是字段属性联动链路
- `x-validate` 是校验链路

其中：

- `x-format` 不允许异步，返回 Promise 会直接报错
- `x-reaction` 可以等待异步结果，并处理 loading 状态
- `x-validate` 既支持同步，也支持异步校验

这种边界能避免很多看似灵活、实则难排查的问题，比如输入时异步格式化、链路阻塞、状态错乱。

## 仓库结构

这是一个基于 `pnpm workspace` 的 monorepo：

```text
.
├── apps
│   ├── demo          # 示例应用，直接展示 schema 渲染效果
│   └── docs          # 文档站点
├── packages
│   ├── core          # 核心模型与协议执行
│   ├── react         # React 绑定层
│   └── ui            # 默认 UI 组件
├── README.md
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

各包职责可以简单理解为：

| 包/应用 | 作用 |
| --- | --- |
| `packages/core` | Form、Field、字段树、联动、表达式、安全控制、校验、数组操作 |
| `packages/react` | `FormProvider`、`SchemaField`、hooks、schema 递归渲染 |
| `packages/ui` | 默认组件与布局组件 |
| `apps/demo` | 协议能力展示、组件映射、handlers 示例 |
| `apps/docs` | 面向使用者的文档与 API 说明 |

## 从零开始，怎么理解这个项目

如果你想在最短时间内建立整体认知，建议按下面顺序看。

### 第 1 步：先跑起来

要求：

- Node.js 18+
- pnpm

安装依赖：

```bash
pnpm install
```

启动 demo：

```bash
pnpm dev
```

启动文档：

```bash
pnpm dev:docs
```

先运行再看代码，能帮助你建立“协议长什么样、最终页面怎么渲染出来”的直觉。

### 第 2 步：先看 demo，不要一上来钻 core

推荐先看：

- `apps/demo/src/schema`
- `apps/demo/src/components/schema-renderer.tsx`
- `apps/demo/src/useSchema.ts`

为什么先看这里：

- 这里能最快回答“schema 在实际项目里怎么写”
- 这里能看到 `components`、`decorators`、`handlers` 是怎么组装起来的
- 这里能看到联动、数组、格式化、校验这些能力在 UI 上的实际表现

### 第 3 步：再看文档里的协议说明

推荐阅读：

- `apps/docs/docs/zh/guide/getting-started.md`
- `apps/docs/docs/zh/guide/protocol.md`

先把这些问题读明白：

- schema 的最小单元是什么
- `x-reaction` 到底在描述什么
- 为什么只有 `static` / `expression` / `match` / `computed`
- 什么能力属于 core，什么能力应该交给业务 handlers

### 第 4 步：理解 React 绑定层是怎么接住 core 的

重点看：

- `packages/react/src/index.tsx`

最值得先理解的几个入口：

- `FormProvider`
- `SchemaField`
- `useForm`
- `useField`
- `useArrayField`

你会看到它做的事情并不复杂：

- 用 Context 暴露 `form`、`components`、`decorators`
- 在 `SchemaField` 中调用 `form.setSchema(schema)`
- 递归遍历 schema，决定渲染普通字段、数组字段还是布局节点
- 把字段状态映射成统一的组件协议

这层读懂后，就能明白项目为什么可以做到“core 无头，UI 可替换”。

### 第 5 步：最后再深入 core

重点看：

- `packages/core/src/form.ts`
- `packages/core/src/field.ts`
- `packages/core/src/types.ts`
- `packages/core/src/validator-runner.ts`
- `packages/core/src/expression-safety.ts`

建议带着问题去读：

- `form.setSchema()` 为什么会重建字段注册表
- 字段依赖是怎么追踪的
- `x-reaction` 是怎么注册、触发和回写属性的
- `x-format` 为什么必须同步
- 数组字段是怎么维护子字段树的
- 表达式为什么要做安全过滤

### 第 6 步：用测试确认你的理解

核心行为测试在：

- `packages/core/src/__tests__/core.test.ts`
- `packages/react/src/__tests__/binding.test.tsx`

运行测试：

```bash
pnpm test
```

如果你只想验证 core：

```bash
pnpm test:core
```

测试是理解行为边界最快的方式，尤其适合确认联动、校验、数组操作这类“看代码不如看断言”的逻辑。

## 一个最小认知模型

你可以把 AlienForm 理解成下面这条链路：

1. 业务定义 schema
2. core 把 schema 变成字段树和响应式状态
3. React 绑定层把字段树映射成组件树
4. UI 组件只负责展示和输入
5. 异步、副作用、业务计算通过 `handlers` 注入

换句话说：

- schema 负责声明结构和规则
- core 负责执行规则
- react 负责连接视图
- ui 负责展示
- 业务负责提供具体能力

这个边界，就是整个项目最重要的设计主线。

## 快速示例

下面是一个最小可运行示例，能帮助你把前面的抽象概念对上代码：

```tsx
import { createForm } from '@alien-form/core'
import { FormProvider, SchemaField } from '@alien-form/react'
import { Button, Input, Select, FormItem } from '@alien-form/ui'

const form = createForm({
  initialValues: { type: 'person' },
  handlers: {
    fetchCities: async ({ deps }) => {
      return [{ label: String(deps.country), value: deps.country }]
    },
  },
})

const components = {
  Input: ({ value, onChange, ...rest }: any) => (
    <Input
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    />
  ),
  Select,
}

const decorators = {
  FormItem,
}

const schema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      title: '类型',
      component: 'Select',
      decorator: 'FormItem',
      dataSource: [
        { label: '个人', value: 'person' },
        { label: '企业', value: 'company' },
      ],
    },
    name: {
      type: 'string',
      title: '名称',
      component: 'Input',
      decorator: 'FormItem',
      x-reaction: {
        title: {
          dependencies: { type: 'type' },
          type: 'expression',
          expression: "$deps.type === 'company' ? '企业名称' : '姓名'",
        },
      },
    },
  },
}

export function App() {
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
      <Button onClick={() => form.submit(console.log)}>提交</Button>
    </FormProvider>
  )
}
```

这个例子里最关键的点是：

- `createForm()` 创建 core 层实例
- `FormProvider` 把实例和组件映射交给 React
- `SchemaField` 负责把 schema 渲染出来
- 字段联动通过 `x-reaction` 声明
- 组件适配层负责把统一协议转换成具体 UI 组件事件

## 常用命令

```bash
pnpm dev           # 启动 demo
pnpm dev:docs      # 启动文档站
pnpm build         # 构建所有包和应用
pnpm test          # 运行全部测试
pnpm test:core     # 只运行 core 测试
```

## 如果你准备开始改代码

给新贡献者几个建议：

- 想改协议，优先看 `packages/core/src/types.ts`
- 想改联动，优先看 `packages/core/src/form.ts`
- 想改数组行为，优先看 `packages/core/src/field.ts`
- 想改渲染方式，优先看 `packages/react/src/index.tsx`
- 想改默认组件，优先看 `packages/ui/src/components`
- 想补充用例，优先看 `apps/demo/src/schema`

## 相关文档

- 中文快速开始：`apps/docs/docs/zh/guide/getting-started.md`
- 中文协议设计：`apps/docs/docs/zh/guide/protocol.md`
- Core API：`apps/docs/docs/zh/api/core.md`
- React API：`apps/docs/docs/zh/api/react.md`

如果你只记住一句话，可以记这个：

> AlienForm 的核心不是“把所有能力都塞进 schema”，而是“把 schema、运行时、渲染层和业务副作用的边界划清楚”。
