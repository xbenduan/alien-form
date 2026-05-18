---
pageType: home

hero:
  name: FormBao
  text: Schema-Driven Form Engine
  tagline: Enterprise schema form documentation built with the latest Rspress localization structure
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
  - title: English Documentation
    details: English pages live under docs/en and are exposed as the default locale without the /en prefix.
  - title: Chinese Documentation
    details: Chinese pages live under docs/zh and are exposed under the /zh route prefix.
  - title: Official Rspress I18n
    details: Language switching now follows the official locales plus _nav.json and _meta.json localization flow.
---

# FormBao

FormBao is an enterprise-oriented Schema Form engine built around JSON Schema, a headless core, React bindings, UI components, and documentation examples.

## Highlights

- Natural protocol fields: `component`, `props`, `decorator`, `dataSource`, and `validators`.
- Field-owned property-level `x-reaction` with exactly four rule types: `static`, `expression`, `match`, and `computed`.
- Safe expressions without arbitrary script execution.
- Framework separation: core and React bindings are independent, leaving room for Vue, Solid, and community bindings.
- Enterprise auditability: async requests are owned by application-level `handlers`; core does not fetch URLs.
