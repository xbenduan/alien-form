# Getting Started

## Installation

```bash
pnpm add @alien-form/core @alien-form/react @alien-form/ui
```

## Minimal Setup

```tsx
import { createForm } from '@alien-form/core'
import { FormProvider, SchemaField } from '@alien-form/react'
import { Input, FormItem } from '@alien-form/ui'

const form = createForm()

const components = {
  Input: ({ value, onChange, ...rest }: any) => (
    <Input
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    />
  ),
}

const decorators = { FormItem }

const schema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      title: 'Name',
      component: 'Input',
      decorator: 'FormItem',
      props: {
        placeholder: 'Enter a name',
      },
    },
  },
}

export function App() {
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
    </FormProvider>
  )
}
```

## Runtime Flow

1. `createForm()` creates a `Form` instance.
2. `FormProvider` places the form model and component registries into React context.
3. `SchemaField` calls `form.setSchema(schema)` and renders the field tree.
4. Each field component receives normalized field props from the renderer.

## Important Notes

- Native text inputs need an adapter because the renderer passes `onChange(value)` while DOM inputs emit events.
- `value ?? ''` is recommended for text-like inputs to avoid React controlled/uncontrolled warnings.
- The schema should use component and decorator identifiers that match the keys registered in `components` and `decorators`.
