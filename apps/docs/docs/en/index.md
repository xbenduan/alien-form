---
pageType: home
title: AlienForm
titleSuffix: Schema-Driven Form Engine

hero:
  name: AlienForm
  text: Schema-Driven Form Engine
  tagline: A form runtime built around a headless core, React bindings, and a constrained schema protocol for enterprise forms.
  image:
    src: /logo.svg
    alt: AlienForm
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Architecture
      link: /guide/architecture
    - theme: alt
      text: API Reference
      link: /api/core/form
    - theme: alt
      text: Patterns
      link: /patterns/introduction

features:
  - title: Headless Core
    details: `@alien-form/core` exposes `createForm`, `IForm`, and `IField` so form logic stays independent from React and UI libraries.
  - title: React As Binding
    details: `@alien-form/react` is the main React entry, centered on `useCreateForm`, `FormProvider`, `SchemaField`, and bridge-oriented hooks.
  - title: Schema With Boundaries
    details: Schema handles structure and field-property derivation, while complex internal rules move into `setup + form.effect(...)`.
  - title: Patterns For Teams
    details: The Patterns section turns common enterprise scenarios into repeatable approaches such as edit initialization, mode switching, and SKU matrices.
---
