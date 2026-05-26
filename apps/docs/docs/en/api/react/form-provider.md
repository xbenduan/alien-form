# FormProvider

## Description

`FormProvider` is the React context entry for `@alien-form/react`. It injects the `form` instance, field component registry, and decorator registry so that `SchemaField` and the hooks can consume them.

## Signature

```tsx
<FormProvider
  form={form}
  components={components}
  decorators={decorators}
  destroyOnUnmount={false}
>
  {children}
</FormProvider>
```

## Props

| Prop | Description |
| --- | --- |
| `form` | required `IForm` instance |
| `components` | optional field component registry |
| `decorators` | optional decorator registry |
| `destroyOnUnmount` | optional, default `false`; when `true`, calls `form.destroy()` as the provider unmounts |
| `children` | subtree rendered inside the provider |

## Default Behavior

- `FormProvider` does not destroy an externally owned form by default.
- Unmount cleanup only happens when `destroyOnUnmount={true}` is explicitly set.
- This avoids accidentally destroying external form instances during React 18 `StrictMode` remounts.

## Typical Usage

### External form instance

```tsx
const form = createForm();

export function App() {
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
    </FormProvider>
  );
}
```

### Let the provider clean up

```tsx
function Page() {
  const form = useCreateForm();

  return (
    <FormProvider form={form} destroyOnUnmount>
      <SchemaField schema={schema} />
    </FormProvider>
  );
}
```

## Notes

- `useForm()` depends on this provider.
- Schema rendering uses the registries from this context.
- React projects will usually import `createForm`, `FormProvider`, and related types directly from `@alien-form/react`.
