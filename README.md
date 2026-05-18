# Formily Bao

Formily Bao is a pnpm workspace for a lightweight Formily-style schema form engine built with Alien Signals and React.

## Packages

- `@formily-bao/core`: headless form model, schema parser, validation, reactions, and async data source support.
- `@formily-bao/ui`: reusable React UI components used by the demo renderer.
- `@formily-bao/demo`: Vite demo app for rendering example schemas.
- `@formily-bao/docs`: VitePress documentation site.

## Requirements

- Node.js 18+
- pnpm

This repository is intended to be managed with pnpm. Avoid mixing npm lockfiles with `pnpm-lock.yaml`.

## Getting Started

```bash
pnpm install
pnpm dev
```

Open the Vite dev server URL printed by the command.

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
  initialValues: { name: 'Bao' },
})

form.setSchema({
  type: 'object',
  required: ['name'],
  properties: {
    name: {
      type: 'string',
      title: 'Name',
      minLength: 2,
      'x-component': 'Input',
    },
  },
})

await form.submit((values) => {
  console.log(values)
})
```

## Notes

- `setSchema` replaces the current field registry and rebuilds fields from the new schema.
- Standard JSON Schema validation keywords such as `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, `format`, `minItems`, `maxItems`, `uniqueItems`, and `const` are supported by core validation.
- `x-async-data-source` supports service-based loading and URL-based loading with method, headers, and body options.
- Expression reactions currently execute JavaScript expressions and should only be used with trusted schemas.

## Testing

Core behavior is covered by Vitest tests under `packages/core/src/__tests__`. Run:

```bash
pnpm test:core
```
