# FormBao

FormBao is a lightweight enterprise Schema Form engine inspired by Formily, but it is not a Formily compatibility layer. It uses a headless core, framework bindings, and a natural schema protocol designed for auditability and long-term extensibility.

## Packages

- `@formily-bao/core`: headless form model, schema parser, validation, safe property-level x-reaction, and computed handler integration.
- `@formily-bao/react`: React binding package for rendering schemas with custom component/decorator maps.
- `@formily-bao/ui`: reusable React UI components used by the demo renderer.
- `@formily-bao/demo`: Vite demo app for rendering example schemas.
- `@formily-bao/docs`: VitePress documentation site.

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
