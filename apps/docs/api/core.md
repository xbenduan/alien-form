# Core API

## `createForm(config?)`

Factory function that returns an `IForm` instance.

```ts
import { createForm } from '@formily-bao/core'

const form = createForm({
  initialValues: { name: '' },
  scope: { upper: (s: string) => s.toUpperCase() },
  services: { fetchUsers: async (params) => [...] },
  transformers: { toOptions: (data) => data.map(d => ({ label: d.name, value: d.id })) },
  effects: (form) => {
    form.registerLifecycle('onFieldValueChange', 'email', (field) => {
      console.log('email changed:', field.value)
    })
  },
})
```

### `FormConfig`

| Property | Type | Description |
|----------|------|-------------|
| `initialValues` | `Record<string, any>` | Initial form values |
| `validateFirst` | `boolean` | Stop validation on first error |
| `effects` | `(form: IForm) => void` | Register lifecycle hooks |
| `scope` | `Record<string, any>` | Custom expression scope variables |
| `services` | `Record<string, Function>` | Async data source service registry |
| `transformers` | `Record<string, Function>` | Response transform registry |

## `IForm`

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `fields` | `Map<string, IField>` | All registered field instances |
| `values` | `Record<string, any>` | Current form values (excludes invisible, void, and array-child fields) |
| `initialValues` | `Record<string, any>` | Initial values passed at creation |
| `valid` | `boolean` | True if no visible field has errors |
| `invalid` | `boolean` | Inverse of `valid` |
| `submitting` | `boolean` | True while `submit()` is executing |
| `errors` | `FieldError[]` | Aggregated errors from all visible fields |

### Methods

```ts
// Create and register a field
form.createField(path: string, schema: IFieldSchema, initialValue?: any): IField

// Access a field by path
form.getField(path: string): IField | undefined

// Set partial field state
form.setFieldState(path: string, setter: (state: Partial<FieldMutableState>) => void): void

// Bulk set values on existing fields
form.setValues(values: Record<string, any>): void

// Update initial values reference
form.setInitialValues(values: Record<string, any>): void

// Reset all fields to initial values
form.reset(): void

// Validate all visible fields; returns true if all pass
form.validate(): Promise<boolean>

// Validate + return values (throws on failure)
form.submit<T>(onSubmit?: (values) => T | Promise<T>): Promise<T>

// Parse schema, create fields, setup reactions/async
form.setSchema(schema: IFormSchema): void

// Get array-type field
form.getArrayField(path: string): IField | undefined

// Remove an item from an array field
form.removeArrayItem(arrayPath: string, index: number): void

// Subscribe to any form change
form.subscribe(listener: () => void): () => void

// Subscribe to a specific field's changes
form.onFieldChange(path: string, listener: (field: IField) => void): () => void

// Subscribe to values object changes
form.onValuesChange(listener: (values) => void): () => void

// Register lifecycle event handler (supports '*' wildcard)
form.registerLifecycle(event: SchemaReactionEffect, path: string, handler): () => void
```

## `IField`

Each field instance is created by `form.createField()` and stores reactive state via Alien Signals.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `path` | `string` | Dot-notation path |
| `value` | `any` | Current value (for arrays, dynamically collects from children) |
| `initialValue` | `any` | Value at creation |
| `display` | `FieldDisplayTypes` | `'visible'` \| `'hidden'` \| `'none'` |
| `pattern` | `FieldPatternTypes` | `'editable'` \| `'readOnly'` \| `'disabled'` \| `'readPretty'` |
| `visible` | `boolean` | `display !== 'none'` |
| `hidden` | `boolean` | `display === 'hidden'` |
| `disabled` | `boolean` | `pattern === 'disabled'` |
| `readOnly` | `boolean` | `pattern === 'readOnly'` |
| `readPretty` | `boolean` | `pattern === 'readPretty'` |
| `editable` | `boolean` | `pattern === 'editable'` |
| `required` | `boolean` | Is required |
| `title` | `string` | Display label |
| `description` | `string` | Help text |
| `errors` | `FieldError[]` | Validation errors |
| `warnings` | `FieldError[]` | Validation warnings |
| `validateStatus` | `ValidateStatus` | `''` \| `'success'` \| `'error'` \| `'warning'` \| `'validating'` |
| `component` | `string` | Component name |
| `componentProps` | `Record<string, any>` | Props passed to component |
| `decorator` | `string` | Decorator name |
| `decoratorProps` | `Record<string, any>` | Props passed to decorator |
| `dataSource` | `Array<{label, value}>` | Options data |
| `loading` | `boolean` | Loading state |
| `data` | `Record<string, any>` | Arbitrary metadata |
| `content` | `any` | Static content (renders directly, bypasses component) |
| `isArrayField` | `boolean` | Whether this is an array-type field |
| `arrayItems` | `IField[][]` | Rows of child fields (array fields only) |

### Methods

```ts
field.setValue(value: any): void
field.setErrors(errors: FieldError[]): void
field.setWarnings(warnings: FieldError[]): void
field.setDataSource(ds: Array<{label, value}>): void
field.setLoading(loading: boolean): void
field.setDisplay(display: FieldDisplayTypes): void
field.setPattern(pattern: FieldPatternTypes): void
field.setComponent(component: string, props?: Record<string, any>): void
field.setDecorator(decorator: string, props?: Record<string, any>): void
field.setState(state: Partial<FieldMutableState>): void
field.validate(): Promise<FieldError[]>
field.reset(): void
field.subscribe(listener: () => void): () => void

// Array operations
field.push(initialValues?: Record<string, any>): void
field.remove(index: number): void
field.moveUp(index: number): void
field.moveDown(index: number): void
```

## React Hooks

```ts
import { useForm, useField, useFormState, useArrayField } from '@formily-bao/core'

// Access form instance from context
const form = useForm()

// Access a field and subscribe to its changes
const field = useField('username')

// Access reactive form state
const { values, valid, submitting, errors } = useFormState()

// Array field helpers
const { field, items, push, remove, moveUp, moveDown } = useArrayField('contacts')
```

## React Components

```tsx
import { FormProvider, SchemaField } from '@formily-bao/core'

<FormProvider form={form} components={{ Input, Select }} decorators={{ FormItem }}>
  <SchemaField schema={schema} />
</FormProvider>
```

- **`FormProvider`** — establishes `FormContext` with form instance, component map, and decorator map.
- **`SchemaField`** — renders the form from a JSON schema. Calls `form.setSchema()` on first mount.

## Lifecycle Events

Register via `form.registerLifecycle()` in the `effects` callback:

| Event | Trigger |
|-------|---------|
| `onFieldInit` | Field created and registered |
| `onFieldMount` | Field component mounted |
| `onFieldUnmount` | Field component unmounted |
| `onFieldValueChange` | Value changed |
| `onFieldInputValueChange` | User input triggered change |
| `onFieldInitialValueChange` | Initial value changed |
| `onFieldValidateStart` | Validation begins |
| `onFieldValidateEnd` | Validation ends |
| `onFieldValidateFailed` | Validation produced errors |
| `onFieldValidateSuccess` | Validation passed |
