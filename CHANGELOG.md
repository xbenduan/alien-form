# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- `form.onError(listener)` and `FormConfig.onError` to subscribe to non-fatal
  runtime errors from reactions, x-format, x-validate, and `$ref` resolution.
  Falls back to `console.warn` when no listener is attached.
- React binding tests covering value propagation, visibility reactions,
  `useFormState` rerenders, array push/remove identity preservation, and
  schema replacement.
- Core test for the `onError` channel.

### Changed
- **Array remove**: `Field.remove(index)` now drops the target row and renames
  the path of every subsequent row in place via `_renamePath`. This preserves
  Field instance identity, subscriptions, and validation errors across
  reindexing — previously the trailing rows were rebuilt and external refs to
  old fields became stale.
- **Form reset**: `form.reset()` now replays all reaction runners inside the
  same batch so visibility / props / dataSource / value reactions re-derive
  against the freshly restored initial values instead of staying with stale
  derivations.
- **Schema `$ref`**: `_resolveRef` now detects circular references, emits a
  `ref-resolve` `FormError`, and returns the local props without `$ref`
  instead of recursing forever.
- **x-format async**: `_runXRuleListSync` now throws a hard `Error` when an
  x-format rule returns a Promise, so silent `[object Promise]` values are
  surfaced as attributable failures.
- **`form.values` caching**: results cached behind a dirty bit invalidated by
  `_bumpVersion`, so repeated reads in a quiet window are O(1).
- **Internal split**: helper utilities extracted from `form.ts` into
  `expression-safety.ts`, `path-utils.ts`, and `validator-runner.ts`.
- **React bindings**: `index.tsx` rewritten in JSX (was manual
  `React.createElement` chains).

### Notes
- Schema sources are assumed trusted; the existing expression denylist remains
  as defense-in-depth, not a sandbox.
