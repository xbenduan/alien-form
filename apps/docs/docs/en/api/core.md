# Core API

`@alien-form/core` currently exports two runtime entry points plus a set of types: `createForm`, `Form`, `Field`, and types such as `IForm`, `IField`, `IFormSchema`, `IFieldSchema`, `RuntimeRuleHandler`, and more.

## Export Overview

| Export | Kind | Purpose |
| --- | --- | --- |
| `createForm(config?)` | function | Creates the `Form` instance; this is the normal entry point for app code |
| `Form` | class | The underlying implementation used by `createForm()` |
| `Field` | class | Field state and array operation implementation |
| `FormConfig` | type | Constructor options for the form |
| `RuntimeRuleHandler` | type | Signature for `computed` handlers used by `x-reaction`, `x-format`, and `x-validate` |
| `FormError` | type | Unified shape for non-fatal runtime protocol errors |

## createForm

```ts
import { createForm } from '@alien-form/core'

const form = createForm({
  initialValues: { contactType: 'email' },
  handlers: {
    fetchCategories: async () => [],
  },
  effects(form) {
    form.onValuesChange((values) => {
      console.log(values)
    })
  },
  onError(error) {
    console.warn(error)
  },
})
```

### FormConfig

| Field | Type | Current implementation |
| --- | --- | --- |
| `initialValues` | `Record<string, any>` | Source of initial values, merged with schema defaults during `createField()` |
| `validateFirst` | `boolean` | Declared in the type, but not used by `Form.validate()` yet |
| `effects` | `(form) => void` | Runs immediately in the `Form` constructor; good for lifecycle subscriptions |
| `scope` | `Record<string, any>` | Adds custom variables into the expression scope |
| `handlers` | `Record<string, RuntimeRuleHandler>` | Lookup table for `computed` rules |
| `onError` | `(error: FormError) => void` | Receives non-fatal reaction, expression, `$ref`, and formatting errors |

## Form Instance

### Readonly State

| Property | Meaning |
| --- | --- |
| `fields` | `Map<string, IField>` for all registered fields |
| `values` | Output values after filtering `display: none`, array child fields, void fields, and applying `x-format.output` |
| `initialValues` | Snapshot passed to the constructor |
| `valid` / `invalid` | Derived from visible field errors |
| `submitting` | Whether `submit()` is currently running |
| `errors` | Flat collection of all visible field errors |

### Core Methods

| Method | Current behavior |
| --- | --- |
| `createField(path, schema, initialValue?)` | Creates a `Field`, applies defaults, input formatting, and the `onFieldInit` lifecycle |
| `getField(path)` | Returns a field instance |
| `setFieldState(path, setter)` | Updates field state through a local setter |
| `setValues(values)` | Batch writes values and applies `x-format.input` before storing them |
| `setInitialValues(values)` | Updates the initial snapshot only |
| `reset()` | Resets every field and replays reaction runners |
| `validate()` | Validates all visible fields and returns `Promise<boolean>` |
| `submit(onSubmit?)` | Validates first, then returns `onSubmit(form.values)` or `form.values` |
| `subscribe(listener)` | Subscribes to the form version |
| `setSchema(schema)` | Clears old fields and reactions, rebuilds the field tree, and wires new reactions |
| `getArrayField(path)` | Returns the instance only if the target is an array field |
| `removeArrayItem(path, index)` | Delegates to the array field `remove(index)` |
| `onFieldChange(path, listener)` | Watches a field path or `*` |
| `onValuesChange(listener)` | Watches `form.values` |
| `onError(listener)` | Watches runtime protocol errors |

## Field Instance

`Field` is the smallest reactive unit created by `Form`. It owns display mode, validation, and array row management.

### Core Properties

| Property | Current behavior |
| --- | --- |
| `path` / `address` | Identical in the current implementation; both are dot paths |
| `value` | Returns the direct value for regular fields; array fields rebuild an array of row objects from child fields |
| `display` | `visible` / `hidden` / `none` |
| `pattern` | `editable` / `readOnly` / `disabled` / `readPretty` |
| `component` / `componentProps` | Component name and props |
| `decorator` / `decoratorProps` | Decorator name and props |
| `dataSource` | Normalized options from `enum` or `dataSource` |
| `loading` | Automatically toggled while async `computed` reactions are running |
| `errors` / `warnings` / `validateStatus` | Validation feedback state |
| `isArrayField` / `arrayItems` | Array marker and row-grouped child field list |

### Core Methods

| Method | Current behavior |
| --- | --- |
| `setValue(value)` | Writes the value and notifies field value change |
| `setState(partial)` | Batch updates display, pattern, title, dataSource, and more |
| `validate()` | Runs required, static validators, then `x-validate` |
| `reset()` | Restores `initialValue` and clears errors and warnings |
| `push(initialValues?)` | Array-only; creates child fields for a new row |
| `remove(index)` | Removes one row and reindexes later rows |
| `moveUp(index)` / `moveDown(index)` | Currently implemented by swapping row values |
| `subscribe(listener)` | Subscribes to field version changes |

## RuntimeRuleHandler

`computed` rules never talk to the network directly. They resolve a handler from `FormConfig.handlers`.

```ts
type RuntimeRuleHandler = (context: {
  field: IField
  form: IForm
  values: Record<string, any>
  deps: Record<string, any>
  dependencies: Record<string, any>
  scope: Record<string, any>
  key: string
  rule: SchemaXRule
  value?: any
  kind?: 'x-reaction' | 'x-format' | 'x-validate'
}) => any | Promise<any>
```

Common use cases:

- Async option loading inside `x-reaction.dataSource`
- Synchronous value normalization inside `x-format`
- Server-side checks inside `x-validate`

## FormError

`onError` receives non-fatal runtime errors and does not automatically break rendering. Current `scope` values include:

- `reaction`
- `x-reaction`
- `x-format`
- `x-validate`
- `ref-resolve`
- `expression`

## Demo: Register Business Handlers

The following pattern comes from `apps/demo/src/components/schema-renderer.tsx` and is the recommended integration style for app code:

```ts
const form = createForm({
  handlers: {
    fetchCategories: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return [
        { label: 'Tech', value: 'tech' },
        { label: 'Design', value: 'design' },
        { label: 'Business', value: 'business' },
      ]
    },
    fetchSubCategories: async ({ deps }) => {
      await new Promise((resolve) => setTimeout(resolve, 400))
      return deps.category ? categoryData[deps.category] || [] : []
    },
    normalizeCode: ({ value }) => String(value ?? '').trim().toUpperCase(),
    checkConfirmCode: async ({ value }) => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return String(value ?? '').trim().toUpperCase() === 'OK'
        ? []
        : [{ message: 'Confirm code must be OK', type: 'x-validate' }]
    },
  },
})
```

## Demo: Watch Values Through effects

```ts
const form = createForm({
  effects(form) {
    form.onValuesChange((values) => {
      console.log('latest values:', values)
    })

    form.onError((error) => {
      console.warn('[form runtime error]', error)
    })
  },
})
```

## Important Implementation Notes

- `form.values` applies `x-format.output`.
- `x-format` runs in a synchronous path; returning a Promise is an error.
- `validateFirst` is typed today but not implemented in the validation flow yet.
