# @alien-form/core Exports

## Description

`@alien-form/core` now exposes a single runtime factory, `createForm`, plus the public types that application code actually depends on.

If you are building a React app, you will usually import `createForm`, `IForm`, and related types from `@alien-form/react`; the React package re-exports them for convenience.

## Runtime Exports

```ts
export { createForm } from "./engine/form/index";
```

| Export | Kind | Description |
| --- | --- | --- |
| `createForm` | function | creates a form runtime instance with return type `IForm` |

## Type Exports

```ts
export type {
  IForm,
  IField,
  IFormSchema,
  IFieldSchema,
  FieldError,
  FieldMutableState,
  ValidateStatus,
  FieldDisplayTypes,
  FieldPatternTypes,
  Validator,
  ValidatorFn,
  ValidatorRule,
  FormConfig,
  FormError,
  EffectOptions,
  EffectContext,
  RuntimeRuleHandler,
  RuntimeRuleHandlerContext,
  DataSourcePolicy,
  SchemaTypes,
} from "./schema/types";
```

## Common Imports

### Create a form

```ts
import { createForm } from "@alien-form/core";

const form = createForm();
```

### Type a form model

```ts
import type { IForm, FormConfig } from "@alien-form/core";

const config: FormConfig = {
  initialValues: {},
};

const useFormModel = (form: IForm) => {
  return form.values;
};
```

### Type a handler

```ts
import type { RuntimeRuleHandler } from "@alien-form/core";

const loadOptions: RuntimeRuleHandler = async (ctx) => {
  return [
    { label: "A", value: "a" },
    { label: "B", value: "b" },
  ];
};
```

## Export Groups

### Runtime and config

- `createForm`
- `IForm`
- `FormConfig`
- `FormError`
- `EffectOptions`
- `EffectContext`

### Fields and state

- `IField`
- `IFormSchema`
- `IFieldSchema`
- `FieldError`
- `FieldMutableState`
- `ValidateStatus`
- `FieldDisplayTypes`
- `FieldPatternTypes`

### Validation and rule extension

- `Validator`
- `ValidatorFn`
- `ValidatorRule`
- `RuntimeRuleHandler`
- `RuntimeRuleHandlerContext`
- `DataSourcePolicy`
- `SchemaTypes`

## Notes

- `Form` and `Field` classes are no longer part of the public runtime export surface; treat `IForm` and `IField` as the supported model contracts.
- `createForm` returns a long-lived runtime object, not a disposable config snapshot.
- Form linkage is standardized on `setup + form.effect(...)` instead of event-style `onXxx` APIs.
