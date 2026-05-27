# AlienForm

AlienForm is a governance-first Schema Form engine designed for forms that are co-authored, reviewed, and maintained long-term by both humans and AI.

## Core Principles

| Problem | AlienForm's Choice |
| --- | --- |
| Field linkage | Derive field properties via `x-reaction`, no imperative cross-field mutations |
| Business async | Scoped to `handlers`, not embedded in schema |
| Internal rules | `createForm({ setup }) + form.effect(...)` |
| Protocol scope | Convergent, not open-ended — minimize implicit behavior |

## Package Structure

| Package | Responsibility |
| --- | --- |
| `@alien-form/core` | Headless runtime — `createForm`, field tree, linkage, validation |
| `@alien-form/react` | React bindings — `useCreateForm`, `FormProvider`, `SchemaField` |
| `@alien-form/ui` | Default component implementations, replaceable |

## Logic Placement

```
schema        → field structure + property derivation (x-reaction / x-format / x-validate)
setup         → internal form rules (form.effect)
React         → view binding + external bridging
handlers      → business async implementations
```

When reading these docs, first decide which layer a piece of logic belongs to, then choose the appropriate API.

## Recommended Reading Order

1. [Getting Started](./getting-started) — establish the `useCreateForm + FormProvider + SchemaField` mental model
2. [Architecture](./architecture) — understand core / react / ui layering and `setup`
3. [Schema Protocol](./schema-protocol) — understand the field property derivation model
4. [x-reaction](./advanced/x-reaction) / [x-format](./advanced/x-format) / [x-validate](./advanced/x-validate) — dynamic protocols
5. [Patterns](/en/patterns/edit-initialization) — recommended patterns for enterprise scenarios

For method signatures, refer to the [API Reference](/en/api/core/form).
