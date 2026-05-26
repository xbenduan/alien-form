# Hooks

The public hooks in `@alien-form/react` fall into three groups:

- lifecycle and context: `useCreateForm`, `useForm`
- state access: `useFormState`, `useField`, `useFieldState`, `useArrayField`
- side effects and flow helpers: `useFormEffect`, `useFormWatch`, `useFormErrors`, `useFormSubmit`, `useFormValidate`

## useCreateForm

Creates and owns a stable `IForm` instance inside React lifecycle. The hook automatically calls `form.destroy()` on unmount.

```ts
const form = useCreateForm({
  initialValues: { name: "" },
});
```

Use it when the current component should own the form lifecycle.

## useForm

Reads the `IForm` instance from the nearest `FormProvider`. It throws when used outside the provider.

```ts
const form = useForm();
```

## useFormState

Returns a form-level snapshot ready for rendering:

```ts
{
  values,
  initialValues,
  valid,
  invalid,
  submitting,
  errors,
}
```

Use it for submit state, form-wide error panels, and overall value inspection.

## useField

Returns a field instance by path and subscribes to that field. If no path is provided, it tries to inherit the nearest `FieldContext`.

```ts
const nameField = useField("name");
```

Returns `null` when the field does not exist.

## useFieldState

Returns a field snapshot suitable for custom rendering:

```ts
const state = useFieldState("name");
```

The returned shape includes:

```ts
{
  value,
  display,
  pattern,
  visible,
  hidden,
  disabled,
  readOnly,
  readPretty,
  editable,
  required,
  errors,
  warnings,
  validateStatus,
  title,
  description,
  loading,
  dataSource,
}
```

Returns `null` when the field does not exist.

## useArrayField

Wraps an array field with convenience accessors and mutation methods:

```ts
const { field, items, push, remove, moveUp, moveDown } = useArrayField("users");
```

- `field`: the array field instance
- `items`: a two-dimensional field array where each row is a group of child fields
- `push/remove/moveUp/moveDown`: direct proxies to the array field instance

## useFormEffect

Registers a dependency-driven side effect through `form.effect(runner)` and cleans it up automatically on unmount.

```ts
useFormEffect((form) => {
  console.log(form.values);
});
```

Use it when a callback reads multiple reactive sources and should rerun automatically.

## useFormWatch

Registers a selector listener through `form.effect(selector, listener, options?)`.

```ts
useFormWatch(
  (form) => form.getField("country")?.value,
  (country, prevCountry) => {
    console.log(country, prevCountry);
  },
  { immediate: true },
);
```

Supports:

- `immediate`: run once immediately after registration
- `equals(prev, next)`: custom equality check

## useFormErrors

Subscribes to non-fatal runtime errors from reactions, formatting, validation, `$ref` resolution, and similar flows.

```ts
useFormErrors((error) => {
  console.warn(error.scope, error.path, error.message);
});
```

## useFormSubmit

Returns a small submit helper with local loading state:

```ts
const { submit, submitting } = useFormSubmit();
```

```ts
await submit(async (values) => {
  await save(values);
});
```

`submitting` here is the hook-local loading state, which is handy for buttons and isolated submit flows.

## useFormValidate

Returns a validation helper:

```ts
const { validate, validating } = useFormValidate();
```

```ts
const valid = await validate();
```

Use it when validation is triggered by an external button or a step-based flow.

## How to Choose

- own the form lifecycle in a component: use `useCreateForm`
- read the runtime instance: use `useForm`
- render form-wide state: use `useFormState`
- render a single field: use `useFieldState`
- express reactive linkage: prefer `useFormEffect` or `useFormWatch`
- bridge submit and validation buttons: use `useFormSubmit` and `useFormValidate`
