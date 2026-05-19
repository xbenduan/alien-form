# 如何学习

AlienForm 是一个强大的工具，但与标准的 React 状态管理相比，它引入了几个新概念。为了高效地掌握它，我们建议遵循以下结构化的学习路径。

## 1. 理解核心概念

在编写任何 React 代码之前，请先了解 AlienForm 是如何独立管理状态的：

- **表单实例 (Form)**：了解 `createForm()` 是如何工作并充当中央枢纽的。
- **字段实例 (Field)**：了解 `Field` 是如何代表单个表单输入，并存储其值、错误和 UI 状态的。
- **架构**：阅读 [架构设计](./architecture) 指南，了解核心层、React 层和 UI 层是如何分离关注点的。

## 2. 学习 Schema 协议

AlienForm 是由 Schema 驱动的。你需要熟悉 JSON Schema 以及 AlienForm 的扩展。

- **标准属性**：`type`、`title`、`description`、`required`、`default`。
- **AlienForm 扩展**：`component`、`decorator`、`x-reaction`、`x-validator`。
- 仔细阅读 [Schema 协议](./schema-protocol) 指南。

## 3. 掌握 React 绑定

了解如何将核心模型和 Schema 连接到 React：

- **FormProvider**：如何注入表单和组件注册表。
- **SchemaField**：它如何将 JSON Schema 转换为 React 组件树。
- **自定义组件**：了解如何编写适配器，使你的 UI 组件能够消费 `value` 和 `onChange`。

## 4. 探索高级特性

一旦你能够构建静态表单，就可以继续学习动态行为：

- **字段属性联动**：阅读 [x-reaction](./advanced/x-reaction) 了解如何派生 `display`、`pattern`、`value`、`dataSource` 等运行时状态。
- **值格式化协议**：阅读 [x-format](./advanced/x-format) 了解输入态与输出态的值转换边界。
- **动态校验协议**：阅读 [x-validate](./advanced/x-validate) 了解跨字段校验、异步校验以及错误返回协议。
- **数组字段**：了解如何使用 `ArrayCards` 或 `ArrayTable` 管理列表数据。
