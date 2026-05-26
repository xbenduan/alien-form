# 架构设计

AlienForm 的架构重点不是“分几层”，而是“每类逻辑该落在哪一层”。

如果把这个边界讲清楚，很多常见争议都会自然消失，比如：

- 为什么内部联动不推荐写成 React `useEffect`
- 为什么 `core` 不直接依赖 React 组件
- 为什么异步请求不直接写进 schema

## 三层结构

### Core 层

`@alien-form/core` 是 framework-agnostic 的 headless runtime，负责：

- `createForm()` 创建 `IForm`
- 字段树创建与维护
- `x-reaction`、`x-format`、`x-validate` 执行
- `form.effect(...)` 驱动的响应式规则
- 校验、提交、数组字段能力

这一层不感知 React，也不持有任何 React 组件实例。

### React 层

`@alien-form/react` 负责把 `core` 接入 React，主要提供：

- `useCreateForm`
- `FormProvider`
- `SchemaField`
- `useForm`、`useFieldState`、`useFormEffect` 等 hooks

它的职责是“绑定”和“桥接”，而不是承载表单内部业务规则。

### UI 层

`@alien-form/ui` 提供默认组件实现，例如：

- `Input`
- `Select`
- `FormItem`
- `FormGrid`
- `ArrayCards`
- `ArrayTable`

这些组件只是协议的默认表现层，可以被替换，但不会反向定义 core 的能力边界。

## 逻辑应该放哪

### 放在 schema

适合 schema 的逻辑：

- 字段结构
- 字段标题、描述、组件、装饰器
- 基于依赖值的字段属性派生
- 值格式化规则
- 校验规则

也就是说，schema 负责“当前字段如何表现”。

### 放在 `setup`

适合 `createForm({ setup })` 的逻辑：

- 表单内部的复杂联动
- 依赖多个字段的派生规则
- 不适合塞进单个字段 `x-reaction` 的内部规则
- 需要在 form 生命周期内注册和清理的 effect

这里的标准写法是 `setup + form.effect(...)`。

### 放在 React

适合 React 层的逻辑：

- 页面级参数和路由变化
- 外部状态同步
- 页面副作用、日志、埋点
- 提交按钮、校验按钮等视图交互桥接

React 是宿主层，不应该承担表单内部规则编排。

## 主要运行时对象

| 对象 | 角色 |
| --- | --- |
| `IForm` | 顶层运行时对象，拥有字段注册表、值树、校验和 effect 能力 |
| `IField` | 单个字段运行时对象，拥有局部状态、数组能力和字段级 effect |
| `FormProvider` | 把 form 与组件注册表注入 React 上下文 |
| `SchemaField` | 将 schema 应用到 form 并递归渲染字段树 |

## 为什么这样分层

- core 可以脱离 UI 单独测试
- React 只是绑定层，不成为模型层的一部分
- UI 可以替换，不影响协议和运行时
- `setup` 能直接挂到响应式图上，比 React 补丁式联动更稳定

## 一句话总结

AlienForm 的架构核心不是“用很多层”，而是“schema 管字段派生，`setup` 管内部规则，React 管视图桥接，UI 管最终呈现”。
