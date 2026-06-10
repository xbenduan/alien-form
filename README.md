# AlienForm

AlienForm is a schema-driven form workspace built as a pnpm monorepo.

## Workspace

- `packages/core`: headless form runtime
- `packages/react`: React bindings for the core runtime
- `packages/cms`: schema and provider helpers for CMS scenarios
- `apps/alien-cms`: local CMS application
- `apps/server-cloudflare`: Cloudflare backend for schema and record APIs

## Current Protocol

AlienForm has been simplified to a smaller runtime model.

- `required` stays as built-in UI + required validation shorthand
- `x-validate` is the custom validation entry
- `x-format.input` runs only during initialization
- `x-format.output` runs during output projection and submit
- `dataSourcePolicy` controls how option changes affect current values

Runtime values support:

- literal values
- expression strings: `"{{ a ? b : c }}"`
- handler strings: `"@handlerName"`
- direct functions
- arrays of runtime values

For detailed runtime docs, see [`packages/core/README.md`](./packages/core/README.md).

## Development

```bash
pnpm install
pnpm dev
pnpm test:core
pnpm build
```
