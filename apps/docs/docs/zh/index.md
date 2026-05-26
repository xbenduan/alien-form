---
pageType: home
title: AlienForm
titleSuffix: Schema 驱动表单引擎

hero:
  name: AlienForm
  text: Schema 驱动表单引擎
  tagline: 一套围绕 headless core、React 绑定层和收敛 schema 协议构建的企业表单运行时。
  image:
    src: /logo.svg
    alt: AlienForm
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: 架构设计
      link: /zh/guide/architecture
    - theme: alt
      text: API 参考
      link: /zh/api/core/form
    - theme: alt
      text: 开发范式
      link: /zh/patterns/introduction

features:
  - title: Headless Core
    details: `@alien-form/core` 负责 `createForm`、`IForm`、`IField` 与规则执行，不依赖 React 和具体 UI 组件。
  - title: React 绑定层
    details: `@alien-form/react` 是 React 项目的主要入口，围绕 `useCreateForm`、`FormProvider`、`SchemaField` 和桥接型 hooks 组织。
  - title: Schema 有边界
    details: schema 负责结构和字段属性派生，复杂内部规则归位到 `setup + form.effect(...)`，业务异步能力归位到 `handlers`。
  - title: 面向团队模式
    details: Patterns 区域把编辑态初始化、形态切换、权限控制、SKU 矩阵等企业场景沉淀成统一写法。
---
