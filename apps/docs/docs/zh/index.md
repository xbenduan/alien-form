---
pageType: home

hero:
  name: FormBao
  text: Schema 驱动表单引擎
  tagline: 基于最新版 Rspress 官方本地化结构构建的双语文档站
  image:
    src: /logo.svg
    alt: FormBao
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: English Docs
      link: /

features:
  - title: 中文文档
    details: 中文内容位于 docs/zh，并通过 /zh 路由前缀对外提供访问。
  - title: 英文文档
    details: 英文内容位于 docs/en，作为默认语言直接输出为无 /en 前缀路由。
  - title: 官方本地化切换
    details: 语言切换基于 locales、locale 首页和 _nav/_meta 的 i18n key 自动完成。
---

# FormBao

FormBao 是面向企业场景的 Schema Form 引擎，基于 JSON Schema 建模，并提供 headless core、React 绑定、UI 组件和文档示例。

## 特性

- 自然字段协议：`component`、`props`、`decorator`、`dataSource`、`validators`。
- 字段自有属性级 `x-reaction`：用 `static`、`expression`、`match`、`computed` 描述动态派生。
- 安全表达式：只做受控表达式求值，不提供任意脚本执行入口。
- 框架分层：core 与 React 绑定解耦，后续可扩展 Vue、Solid 等社区绑定。
- 企业可审计：异步请求由应用层 `handlers` 接管，core 不内置 URL 获取。

## 快速入口

- [快速开始](./guide/getting-started)
- [协议设计](./guide/protocol)
- [联动协议](./advanced/linkage)
- [异步选项](./advanced/async-datasource)
- [Schema API](./api/schema)
- [Core API](./api/core)
