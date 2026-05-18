# FormBao

FormBao is a lightweight enterprise Schema Form engine inspired by Formily, but it is not a Formily compatibility layer. It uses a headless core, framework bindings, and a natural schema protocol designed for auditability and long-term extensibility.

## Packages

- `@formily-bao/core`: headless form model, schema parser, validation, safe property-level x-reaction, and computed handler integration.
- `@formily-bao/react`: React binding package for rendering schemas with custom component/decorator maps.
- `@formily-bao/ui`: reusable React UI components used by the demo renderer.
- `@formily-bao/demo`: Vite demo app for rendering example schemas.
- `@formily-bao/docs`: Rspress documentation site.

## Requirements

- Node.js 18+
- pnpm

## Getting Started

```bash
pnpm install
pnpm dev
```

## Common Commands

```bash
pnpm build          # build all workspace packages/apps
pnpm test           # run workspace tests
pnpm test:core      # run core tests only
pnpm dev            # start the demo app
pnpm dev:docs       # start the documentation site
```

## Core Usage

```ts
import { createForm } from '@formily-bao/core'

const form = createForm({
  initialValues: { type: 'person' },
  handlers: {
    fetchCities: async ({ deps }) => [{ label: String(deps.country), value: deps.country }],
  },
})

form.setSchema({
  type: 'object',
  properties: {
    type: {
      type: 'string',
      component: 'Select',
      dataSource: [
        { label: '个人', value: 'person' },
        { label: '企业', value: 'company' },
      ],
    },
    name: {
      type: 'string',
      title: '名称',
      component: 'Input',
      x-reaction: {
        title: {
          dependencies: { type: 'type' },
          type: 'expression',
          expression: "$deps.type === 'company' ? '企业名称' : '姓名'",
        },
        props: {
          dependencies: { type: 'type' },
          type: 'match',
          source: '$deps.type',
          match: {
            company: { placeholder: '请输入企业名称' },
            default: { placeholder: '请输入姓名' },
          },
        },
      },
    },
  },
})
```

## Reaction Protocol

`x-reaction` are field-owned property-level derivation rules. The schema key is the property to write, and the rule describes how to derive that property.

Supported built-in rule types are exactly:

- `static`
- `expression`
- `match`
- `computed`

Core intentionally does not support cross-field control, branch/action layers, arbitrary script execution, or built-in URL fetching. Async data loading should be implemented by application-owned `handlers` and referenced from `computed` rules.

## Notes

- `setSchema` replaces the current field registry and rebuilds fields from the new schema.
- Standard JSON Schema validation keywords such as `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, `format`, `minItems`, `maxItems`, `uniqueItems`, and `const` are supported by core validation.
- Expression x-reaction use raw expression strings, for example `$deps.type === 'company'`, not double-brace templates.
- Remote schemas should keep business effects in registered handlers rather than embedding imperative logic in schema.

## Testing

Core behavior is covered by Vitest tests under `packages/core/src/__tests__`. Run:

```bash
pnpm test:core
```

## Schema Protocol Reference

### Rule Shape

Every `x-reaction` / `x-format` / `x-validate` rule shares the same envelope:

```ts
{
  type: 'static' | 'expression' | 'match' | 'computed',
  dependencies?: string[] | Record<string, string>,
  // type-specific fields below
}
```

`dependencies` may be:

- **Array form** — `['otherField', 'sibling.path']`. Resolved values are
  available in expressions as positional `$deps[0]`, `$deps[1]`, …
- **Object form** — `{ aliasName: 'otherField' }`. Resolved values are exposed
  under `$deps.aliasName`. This is the recommended form because expressions
  stay readable when fields are renamed.
- **Relative paths** — `'.sibling'` resolves against the current field's
  parent (useful inside array items). `'..uncle'` walks one level further up.

### Rule Types

| Type | Meaning |
|---|---|
| `static` | Returns `value` verbatim. Useful for one-shot defaults. |
| `expression` | Evaluates `expression` (raw JS expression) against `{ $deps, $value, $self, $form, ...scope }`. |
| `match` | Looks up `match[$deps.<source>]`; falls back to `match.default` when no key matches. |
| `computed` | Calls `handlers[handler]({ deps, depsArray, value, self, form, kind, params })`. May return a Promise inside `x-reaction`/async `x-validate`. |

### Synchronous vs Asynchronous Phases

- `x-format` runs on the **synchronous** value-update path. Async (Promise)
  results from `computed` handlers throw a hard error here — async work must
  live in `x-reaction` or the async portion of `x-validate`.
- `x-reaction` is reactive and awaits Promises returned by `computed`
  handlers; deps changes re-fire the runner.
- `x-validate` supports both sync and async runs; async is awaited inside
  `form.validate()`.

### Expression Safety

`expression` rules are evaluated via `new Function(...)` after a defense-in-depth
denylist filter (no `import`, `require`, `__proto__`, `globalThis`, etc.).
The filter is **not** a sandbox — schema sources are assumed trusted.

### Handlers

```ts
handlers: {
  fetchCities: async ({ deps, value, self, form, kind, params }) => { … },
}
```

The `kind` field identifies the calling phase (`x-reaction` | `x-format` |
`x-validate`) so a single handler can branch on context. `params` contains
the rule-level `params` object for `computed` rules.

### Errors

```ts
form.onError((e) => {
  // e.scope: 'reaction' | 'x-reaction' | 'x-format' | 'x-validate' | 'ref-resolve' | 'expression'
  // e.path, e.key, e.message, e.cause
})
```

Hosts that subscribe take full ownership; without a listener errors fall back
to `console.warn` so silent failures stay debuggable.

### dataSource Policies

When a field's `dataSource` is recomputed by a reaction, its current value is
reconciled by `dataSourcePolicy`:

| Policy | Behavior on dataSource change |
|---|---|
| `preserve` (default) | keep current value as-is |
| `clear` | reset to schema default |
| `filter` | keep current value only if it still appears in the new options |
| `first` | adopt the first option's value |

### Lifecycle Events

`onFieldInit`, `onFieldMount`, `onFieldValueChange`, `onFieldValidateStart`,
`onFieldValidateEnd`, `onFieldUnmount` are dispatched via the registry; bind
in `FormConfig.effects(form)` using `form.registerLifecycle(event, path, fn)`.
