# Form

## Description

`Form` is the top-level runtime model in `@alien-form/core`. It owns the field registry, schema setup, values, submission state, validation entry points, and subscriptions.

## Creation

```ts
import { createForm } from '@alien-form/core'

const form = createForm()
```

## Core Properties

| Property | Type | Description |
| --- | --- | --- |
| `fields` | `Map<string, IField>` | registered field instances |
| `values` | `Record<string, any>` | output values after visibility filtering and `x-format.output` |
| `initialValues` | `Record<string, any>` | initial snapshot |
| `valid` | `boolean` | whether visible fields currently have errors |
| `invalid` | `boolean` | inverse of `valid` |
| `submitting` | `boolean` | current submit state |
| `errors` | `FieldError[]` | flattened visible field errors |

## Core Methods

| Method | Description |
| --- | --- |
| `setSchema(schema)` | rebuild field registry and reactions from schema |
| `getField(path)` | return a field by path |
| `setValues(values)` | batch-write values into existing fields |
| `validate()` | validate visible fields |
| `submit(onSubmit?)` | validate and return output values |
| `reset()` | reset every field to its initial value |
| `subscribe(listener)` | subscribe to form-level updates |
| `onValuesChange(listener)` | subscribe to output-value changes |
| `onError(listener)` | subscribe to non-fatal runtime errors |

## Notes

- `setSchema()` clears old fields and reactions before rebuilding.
- `values` is derived, not a mutable state bag.
- `submit()` throws when validation fails and attaches message strings to the thrown error.
