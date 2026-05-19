# React API

`@alien-form/react` is the React binding layer for the current repository. It connects `Form` / `Field` models into React context and renders schema definitions into component trees.

## Export Overview

| Export | Kind | Purpose |
| --- | --- | --- |
| `FormProvider` | component | Injects `form`, component map, and decorator map |
| `SchemaField` | component | Renders a full form from schema |
| `useForm()` | hook | Returns the current `form` |
| `useField(path?)` | hook | Returns a field instance and subscribes to it |
| `useFormState()` | hook | Reads `values`, `valid`, `invalid`, `submitting`, and `errors` |
| `useArrayField(path)` | hook | Convenience API for array fields |
| `FormContext` / `FieldContext` | context | For advanced custom components |
| `ComponentMap` / `DecoratorMap` | types | Registry shapes |

## FormProvider

```tsx
<FormProvider form={form} components={components} decorators={decorators}>
  <SchemaField schema={schema} />
</FormProvider>
```

### Props

| Field | Type | Meaning |
| --- | --- | --- |
| `form` | `IForm` | Required, usually created by `createForm()` |
| `components` | `Record<string, React.ComponentType<any>>` | Optional field component registry |
| `decorators` | `Record<string, React.ComponentType<any>>` | Optional decorator registry |
| `children` | `ReactNode` | Child subtree |

The current implementation memoizes the context value with `useMemo()`, so changing the `form`, `components`, or `decorators` references updates the subtree.

## SchemaField

`SchemaField` is more than a recursive renderer. It is also the schema initialization entry point:

1. Calls `form.setSchema(schema)` inside `useEffect()`.
2. Lets `Form` clear old fields, rebuild new fields, and recreate reactions.
3. Sorts root properties by `order`, then renders them through `SchemaFieldItem`.

### Current Rendering Rules

| Schema shape | Current behavior |
| --- | --- |
| `type: 'void'` with `properties` | Treated as a layout container and optionally renders `schema.component` |
| `type: 'object'` with `properties` but no `component` | Renders children directly without an extra wrapper |
| `type: 'array'` with `items.properties` | Uses `ArrayFieldRenderer` |
| Other fields | Uses `FieldRenderer` |

## Hooks

### useForm()

Must be used inside `FormProvider`; otherwise it throws.

```tsx
const form = useForm()
```

### useField(path?)

- With `path`, it returns that field.
- Without `path`, it falls back to the parent field path from `FieldContext`.
- The current implementation subscribes through `field.subscribe()`, so field updates re-render the component.
- If no `FormProvider` exists, it returns `null`.

```tsx
const field = useField('contactType')
```

### useFormState()

Returns a rendering-friendly snapshot instead of the full `form` object:

```ts
{
  values,
  valid,
  invalid,
  submitting,
  errors,
}
```

### useArrayField(path)

Provides a small wrapper around array field methods:

```ts
const { field, items, push, remove, moveUp, moveDown } = useArrayField('contacts')
```

Internally it still relies on `useField(path)`.

## Component Registration Contract

`FieldRenderer` passes these props into normal field components:

```ts
{
  ...field.componentProps,
  value: field.value,
  onChange: (value) => field.setValue(value),
  disabled: field.disabled,
  readOnly: field.readOnly,
  readPretty: field.readPretty,
  loading: field.loading,
  pattern: field.pattern,
  dataSource?: field.dataSource,
}
```

A decorator receives:

```ts
{
  ...field.decoratorProps,
  label: field.title,
  required: field.required,
  errors: field.errors,
  warnings: field.warnings,
  description: field.description,
  validateStatus: field.validateStatus,
  pattern: field.pattern,
}
```

## ReadPretty Variant Convention

When a field is in `readPretty` mode, `FieldRenderer` looks for these component names first:

- `${field.component}.ReadPretty`
- `ReadPretty.${field.component}`

If neither exists, it falls back to the base component.

## Demo: Register Adapter Components

This is the core pattern used in `apps/demo/src/components/schema-renderer.tsx`:

```tsx
const components = {
  Input: ({ value, onChange, ...rest }: any) => (
    <Input
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    />
  ),
  Textarea: ({ value, onChange, ...rest }: any) => (
    <Textarea
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    />
  ),
  Select,
  Checkbox,
  Switch,
  DateInput,
  ItemInput,
  RadioGroup,
  Rating,
  FormGrid,
  FormLayout,
  FormSection,
  ArrayCards,
  ArrayTable,
}

const decorators = {
  FormItem,
}
```

Two important notes:

- `Input` / `Textarea` should use `value ?? ''` to avoid React controlled/uncontrolled warnings.
- Components such as `Select`, `Checkbox`, `Switch`, and `Rating` already emit values, so they do not need DOM-event adapters.

## Demo: SchemaField + submit

```tsx
const form = createForm({ handlers })

<FormProvider form={form} components={components} decorators={decorators}>
  <SchemaField schema={schema.schema} />
</FormProvider>
```

The demo submit flow also uses `form.submit()` directly:

```tsx
const values = await form.submit()
```

## Important Implementation Notes

- `SchemaField` calls `setSchema()` again whenever the `schema` or `form` reference changes.
- `useField()` returns `null` for missing fields; custom components should guard accordingly.
- `ArrayFieldRenderer` subscribes to both the array field and the whole `form` so row mutations refresh immediately.
