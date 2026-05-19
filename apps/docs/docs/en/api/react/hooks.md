# Hooks

## useForm

Returns the current form instance from context.

## useField

Returns a field instance by path and subscribes to field updates.

## useFormState

Returns a rendering-friendly snapshot:

```ts
{
  values,
  valid,
  invalid,
  submitting,
  errors,
}
```

## useArrayField

Wraps an array field with a convenience interface:

```ts
const { field, items, push, remove, moveUp, moveDown } = useArrayField('users')
```
