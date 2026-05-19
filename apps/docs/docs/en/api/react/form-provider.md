# FormProvider

## Description

`FormProvider` is the entry component of `@alien-form/react`. It injects the form model, field component registry, and decorator registry into React context.

## Signature

```tsx
<FormProvider form={form} components={components} decorators={decorators}>
  {children}
</FormProvider>
```

## Props

| Prop | Description |
| --- | --- |
| `form` | required `IForm` instance |
| `components` | optional field component registry |
| `decorators` | optional decorator registry |
| `children` | subtree rendered within the provider |

## Notes

- `useForm()` depends on this provider.
- Schema rendering uses the registries from this context.
