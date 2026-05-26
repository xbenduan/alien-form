# Getting Started

## Installation

```bash
pnpm add @alien-form/react @alien-form/ui
```

## Minimal Example

```tsx
import { useCreateForm, FormProvider, SchemaField } from "@alien-form/react";
import { Input, FormItem } from "@alien-form/ui";

const components = { Input };
const decorators = { FormItem };

const schema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      title: "Name",
      component: "Input",
      decorator: "FormItem",
      required: true,
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

1. `useCreateForm()` creates and holds a stable `IForm` instance
2. `FormProvider` injects the form model and component registry
3. `SchemaField` calls `form.setSchema(schema)` and recursively renders the field tree
4. The renderer passes field properties to each registered component

## Advanced Usage

### External Form Instance

```tsx
import { createForm } from "@alien-form/react";

const form = createForm({ initialValues: { name: "Alice" } });

function App() {
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
    </FormProvider>
  );
}
```

### Linkage with Setup

```tsx
const form = createForm({
  initialValues: { country: "us" },
  handlers: {
    fetchCities: async ({ deps }) => {
      const res = await fetch(`/api/cities?country=${deps.country}`);
      return (await res.json()).map((c) => ({ label: c.name, value: c.code }));
    },
  },
  setup(form) {
    form.effect(
      (f) => f.getField("country")?.value,
      () => { /* handler re-executes automatically on dependency change */ }
    );
  },
});
```

## Notes

- Text inputs need an adapter: the renderer passes `onChange(value)`, DOM fires event objects
- Use `value ?? ''` to avoid React controlled/uncontrolled warnings
- `component: 'Input'` in schema must match the key in the `components` registry
- React projects import directly from `@alien-form/react` — it re-exports core types
- Internal linkage belongs in `setup + form.effect(...)`, not React `useEffect`
