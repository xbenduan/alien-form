---
layout: home

hero:
  name: FormBao
  text: Schema 驱动的表单引擎
  tagline: 基于 Alien Signals 响应式系统，完整实现 Formily Schema 协议
  image:
    src: /logo.svg
    alt: FormBao
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: API 参考
      link: /zh/api/core

features:
  - title: Alien Signals 响应式
    details: 基于 signal/effect/computed 的细粒度响应系统，每个字段独立更新，无需全树 diff
  - title: 纯 JSON Schema
    details: 完整实现 Formily Schema 协议 x-* 扩展，一份 JSON 定义完整表单
  - title: 声明式联动
    details: 主动/被动联动模式，内置表达式引擎，支持 $self、$form、$values、$deps、$target
  - title: 数组字段
    details: 一等公民支持可重复字段 — ArrayCards 和 ArrayTable，push/remove/moveUp/moveDown
  - title: 异步数据源
    details: x-async-data-source 加载远程选项，支持依赖级联和自动重新加载
  - title: 可扩展组件
    details: 自由注册自定义组件和装饰器，支持 ReadPretty 模式
---
