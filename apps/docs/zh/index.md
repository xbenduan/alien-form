# FormBao

FormBao 是面向企业场景的 Schema Form 引擎，基于 JSON Schema 建模，并提供 headless core、React 绑定、UI 组件和文档示例。

## 特性

- 自然字段协议：`component`、`props`、`decorator`、`dataSource`、`validators`。
- 字段自有属性级 `reactions`：用 `static`、`expression`、`match`、`computed` 描述动态派生。
- 安全表达式：只做受控表达式求值，不提供任意脚本执行入口。
- 框架分层：core 与 React 绑定解耦，后续可扩展 Vue、Solid 等社区绑定。
- 企业可审计：异步请求由应用层 `reactionHandlers` 接管，core 不内置 URL 获取。

## 快速入口

- [快速开始](./guide/getting-started)
- [协议设计](./guide/protocol)
- [联动协议](./advanced/linkage)
- [异步选项](./advanced/async-datasource)
- [Schema API](./api/schema)
- [Core API](./api/core)
