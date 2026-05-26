# Getting Started

## Installation

```bash
pnpm add @alien-form/react @alien-form/ui
```

## Minimal Setup

```tsx
import { useCreateForm, FormProvider, SchemaField } from "@alien-form/react";
import { Input, FormItem } from "@alien-form/ui";

const components = {
  Input: ({ value, onChange, ...rest }: any) => (
    <Input value={value ?? ""} onChange={(event) => onChange(event.target.value)} {...rest} />
  ),
};

const decorators = { FormItem };

const schema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      title: "Name",
      component: "Input",
      decorator: "FormItem",
      props: {
        placeholder: "Enter a name",
      },
    },
  },
};

export function App() {
  const form = useCreateForm();

  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
    </FormProvider>
  );
}
```

## Runtime Flow

1. `useCreateForm()` creates and owns a stable `IForm` instance inside React lifecycle.
2. `FormProvider` places the form model and component registries into React context.
3. `SchemaField` calls `form.setSchema(schema)` and renders the field tree.
4. Each field component receives normalized field props from the renderer.

## Advanced Pattern

If your page already owns a form instance outside React, you can still pass it directly into `FormProvider`:

```tsx
import { createForm, FormProvider, SchemaField } from "@alien-form/react";

const form = createForm();
```

This pattern is useful when:

- form lifecycle is managed outside the current component
- the same form instance is reused outside React
- `destroyOnUnmount` is used to let the provider take over cleanup when needed

## Important Notes

- Native text inputs need an adapter because the renderer passes `onChange(value)` while DOM inputs emit events.
- `value ?? ''` is recommended for text-like inputs to avoid React controlled/uncontrolled warnings.
- The schema should use component and decorator identifiers that match the keys registered in `components` and `decorators`.
- React projects only need `@alien-form/react`; it re-exports `createForm` and the commonly used core types.
- Complex internal linkage should usually live in `createForm({ setup }) + form.effect(...)`, not in patch-style React `useEffect`.
