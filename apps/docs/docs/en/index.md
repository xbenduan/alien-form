---
pageType: home

hero:
  name: FormBao
  text: Schema-Driven Form Engine
  tagline: Bilingual docs aligned with the real source code across core, react, ui, and demo-backed protocol examples
  image:
    src: /logo.svg
    alt: FormBao
  actions:
    - theme: brand
      text: Getting Started
      link: /guide/getting-started
    - theme: alt
      text: 中文文档
      link: /zh/

features:
  - title: Core / React / UI Layers
    details: The docs follow the real package exports and split the runtime into headless core, React bindings, and UI components.
  - title: Protocols Match Implementation
    details: `x-reaction`, `x-format`, `x-validate`, and `dataSourcePolicy` are documented from the current codebase instead of an idealized design.
  - title: Demo In Every API Page
    details: Examples come from `apps/demo` and are embedded into the related API pages so the behavior stays grounded.
---

# FormBao

FormBao is an enterprise-oriented schema form engine made of three runtime packages:

- `@formily-bao/core`: form model, field state, expression evaluation, and dynamic protocol execution.
- `@formily-bao/react`: React context, schema renderer, and hooks.
- `@formily-bao/ui`: default UI widgets and layout containers.

## What These Docs Emphasize

- Real exports only: every API page is based on what `packages/*/src/index.*` currently exports.
- Real runtime behavior: for example, `SchemaField` calls `form.setSchema()`, `useField()` subscribes to field changes, and `form.values` applies `x-format.output`.
- Real demos: snippets are adapted from `apps/demo` instead of being invented in isolation.

## Quick Links

- [Getting Started](./guide/getting-started)
- [Core API](./api/core)
- [React API](./api/react)
- [Schema API](./api/schema)
- [Components API](./api/components)
- [Linkage](./advanced/linkage)
- [Array Fields](./advanced/array-fields)
- [Async Data Source](./advanced/async-datasource)
