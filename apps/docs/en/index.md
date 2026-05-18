---
layout: home

hero:
  name: FormBao
  text: Schema-Driven Form Engine
  tagline: Powered by Alien Signals. Fully implements the Formily Schema Protocol.
  image:
    src: /logo.svg
    alt: FormBao
  actions:
    - theme: brand
      text: Get Started
      link: /en/guide/getting-started
    - theme: alt
      text: API Reference
      link: /en/api/core

features:
  - title: Alien Signals Reactivity
    details: Fine-grained reactivity via signal/effect/computed. Each field is an independent reactive unit, with no full-tree re-renders.
  - title: Pure JSON Schema
    details: Enterprise Schema Protocol inspired by Formily. Define forms entirely in JSON.
  - title: Declarative Linkage
    details: Active and passive field linkage modes with an expression engine supporting $self, $form, $values, $deps, $target.
  - title: Array Fields
    details: First-class support for repeatable fields with ArrayCards and ArrayTable operations like push, remove, moveUp, and moveDown.
  - title: Async Data Sources
    details: Load remote options with asyncDataSource, including dependency-based cascading and automatic reload.
  - title: Extensible Components
    details: Register custom components and decorators, with ReadPretty support for display-only variants.
---
