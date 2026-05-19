# @alien-form/core Exports

## Description

The `@alien-form/core` entry point exports runtime factories, model classes, and public types. Business code usually only needs `createForm`. React projects usually use core indirectly through `@alien-form/react`.

## Runtime Exports

```ts
export { createForm, Form } from './form'
export { Field } from './field'
```

| Export | Kind | Description |
| --- | --- | --- |
| `createForm` | function | recommended entry for creating a form model |
| `Form` | class | form model implementation; usually does not need to be instantiated directly |
| `Field` | class | field model implementation; usually created by `form.setSchema()` |

## Type Exports

```ts
export type {
  IForm,
  IField,
  IFormSchema,
  IFieldSchema,
  FieldError,
  FieldValue,
  FieldState,
  ValidateStatus,
  FieldMutableState,
  SchemaXRuleType,
  SchemaReactionKey,
  SchemaXRule,
  SchemaRule,
  SchemaRuleSet,
  SchemaReactions,
  SchemaFormat,
  SchemaXValidate,
  DataSourcePolicy,
  RuntimeRuleHandlerContext,
  RuntimeRuleHandler,
  SchemaTypes,
  FieldPatternTypes,
  FieldDisplayTypes,
  ValidatorFormats,
  Validator,
  ValidatorFn,
  ValidatorRule,
  FormConfig,
  FormError,
  FormErrorScope,
} from './types'
```

## Common Imports

### Create a form

```ts
import { createForm } from '@alien-form/core'

const form = createForm()
```

### Type a form model

```ts
import type { IForm, FormConfig } from '@alien-form/core'

const config: FormConfig = {
  initialValues: {}
}

const useFormModel = (form: IForm) => {
  return form.values
}
```

### Type a handler

```ts
import type { RuntimeRuleHandler } from '@alien-form/core'

const loadOptions: RuntimeRuleHandler = async (ctx) => {
  return [
    { label: 'A', value: 'a' },
    { label: 'B', value: 'b' }
  ]
}
```

## Export Groups

### Form model

- `createForm`
- `Form`
- `IForm`
- `FormConfig`
- `FormError`
- `FormErrorScope`

### Field model

- `Field`
- `IField`
- `FieldError`
- `FieldValue`
- `FieldState`
- `FieldMutableState`
- `ValidateStatus`

### Schema protocol

- `IFormSchema`
- `IFieldSchema`
- `SchemaTypes`
- `SchemaXRuleType`
- `SchemaReactionKey`
- `SchemaXRule`
- `SchemaRule`
- `SchemaRuleSet`
- `SchemaReactions`
- `SchemaFormat`
- `SchemaXValidate`
- `DataSourcePolicy`

### Validation types

- `ValidatorFormats`
- `Validator`
- `ValidatorFn`
- `ValidatorRule`

### Runtime extension

- `RuntimeRuleHandler`
- `RuntimeRuleHandlerContext`

## Notes

- `createForm` returns `IForm`; the public API in docs follows `IForm`.
- `Form` and `Field` classes can be imported, but business code usually does not instantiate them directly.
- Some runtime capabilities, such as `registerLifecycle`, currently exist on the `Form` class but are not yet declared on `IForm`. If they should be stable API, their type definitions should be added later.
