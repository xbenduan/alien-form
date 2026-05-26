# Introduction

AlienForm is a Schema Form runtime for enterprise applications. The goal is not only to render forms, but to keep a few critical concerns explicit:

- who owns the value tree
- who owns field instances
- whether linkage belongs in schema, core, or React
- where business async behavior should live

The current project standardizes on this split:

- `@alien-form/core` provides the headless runtime and exposes `createForm`, `IForm`, and `IField`
- `@alien-form/react` is the main entry for React applications
- `@alien-form/ui` only provides default component implementations and does not define protocol boundaries

## Why This Layering Exists

As forms become more complex, the hard part is not “having inputs”. The hard part is:

- expressing linkage rules in a way that stays readable
- decoupling form values from backend payload shapes
- integrating requests, permissions, caching, and telemetry without polluting core
- keeping docs, examples, and runtime behavior aligned over time

AlienForm answers those problems with a constrained runtime model:

- `createForm()` creates a long-lived `IForm` runtime object
- `form.getField(path)` returns `IField`, which owns local field state
- `SchemaField` applies schema to the form and renders the field tree recursively
- internal form rules belong in `createForm({ setup })`, driven by `form.effect(...)`
- remote data and business side effects are injected through `handlers` instead of being embedded into schema DSL

## What This Documentation Covers

The docs are organized into two layers:

- `Guide`: problem framing, architectural boundaries, and recommended patterns
- `API`: the real public contracts, method signatures, and behavioral boundaries

When reading the Guide, the main goal is to learn where logic should live:

- schema describes structure and field-property derivation
- `setup` hosts internal form rules
- React handles view binding and external bridges
- `handlers` host business async implementations

## Package Map

| Package | Responsibility |
| --- | --- |
| `@alien-form/core` | headless form runtime with `createForm`, field trees, rule execution, validation, and array support |
| `@alien-form/react` | React context, hooks, `FormProvider`, and `SchemaField` |
| `@alien-form/ui` | default widgets, layout components, and array presentation components |

## Recommended Reading Order

1. Start with [Getting Started](./getting-started) and build the base mental model of `useCreateForm + FormProvider + SchemaField`.
2. Continue with [Architecture](./architecture) to understand the `core / react / ui` boundary.
3. Then read [Schema Protocol](./schema-protocol) and [x-reaction](./advanced/x-reaction) to understand field-property derivation.
4. Move to [API / Core / Form](/api/core/form), [API / Core / Field](/api/core/field), and [API / React / Hooks](/api/react/hooks) when you need exact contracts.
