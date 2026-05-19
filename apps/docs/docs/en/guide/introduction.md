# Introduction

AlienForm is a schema-driven form solution for enterprise applications. The project is split into a headless core, a React binding layer, and a UI component layer. The goal is not only to render forms, but to make field state, value transformations, validation, and reactions predictable.

## Why Another Form Layer?

Form-heavy applications are difficult for a few recurring reasons:

- Field count grows quickly, and uncontrolled rerendering becomes expensive.
- Field linkage logic mixes UI conditions, data conditions, and async side effects.
- Input values often do not match the shape required by backend payloads.
- Dynamic configuration requires a protocol that can describe both data and UI concerns.

AlienForm answers those problems with a small set of runtime concepts:

- `Form`: the top-level model that owns fields, values, errors, subscriptions, and schema setup.
- `Field`: the reactive unit that stores value, display mode, interaction mode, validation state, and array helpers.
- `Schema`: a JSON object that describes structure, UI registration keys, validation, and reactions.

## What This Documentation Covers

The documentation is split into two parts:

- `Guide`: concepts, runtime design, and learning path.
- `API`: reference pages for the core model, React bindings, and the schema protocol.

This rewrite intentionally follows a reference-driven style similar to the official Formily documentation:

- Guide pages explain the problem space and the design intent.
- API pages describe constructor inputs, attributes, methods, and behavior boundaries.

## Package Map

| Package             | Responsibility                                               |
| ------------------- | ------------------------------------------------------------ |
| `@alien-form/core`  | form model, field model, validation, reactions, schema setup |
| `@alien-form/react` | React context, hooks, schema rendering                       |
| `@alien-form/ui`    | default widgets, layout containers, array renderers          |

## Recommended Reading Order

1. Start from [Getting Started](./getting-started) to understand the minimum runtime setup.
2. Continue with [Architecture](./architecture) to see how the layers fit together.
3. Read [Schema Protocol](./schema-protocol) before reading the API reference.
4. Move into [API / Core / Form](/api/core/form) and [API / Shared / Schema](/api/shared/schema) when you need exact signatures and runtime rules.
