# Getting Started

This page only covers functionality that is implemented and exported in the current repository: `@formily-bao/core`, `@formily-bao/react`, and `@formily-bao/ui`.

## Installation

```bash
pnpm add @formily-bao/core @formily-bao/react @formily-bao/ui
```

## Minimal Working Example

`FieldRenderer` passes a unified field contract into your components: `value`, `onChange`, `disabled`, `readOnly`, `readPretty`, `loading`, and `pattern`. Native text inputs such as `Input` and `Textarea` still emit DOM events, so you usually add a thin adapter layer.

```tsx
import { createForm } from '@formily-bao/core'
import { FormProvider, SchemaField } from '@formily-bao/react'
import { Button, Input, Select, FormItem } from '@formily-bao/ui'

const form = createForm({
  initialValues: { role: 'developer' },
})

const components = {
  Input: ({ value, onChange, ...rest }: any) => (
    <Input
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    />
  ),
  Select,
}

const decorators = { FormItem }

const schema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      title: 'Username',
      required: true,
      component: 'Input',
      decorator: 'FormItem',
      validators: [{ minLength: 3, message: 'At least 3 characters' }],
      props: { placeholder: 'Enter a username' },
    },
    role: {
      type: 'string',
      title: 'Role',
      component: 'Select',
      decorator: 'FormItem',
      dataSource: [
        { label: 'Developer', value: 'developer' },
        { label: 'Designer', value: 'designer' },
      ],
    },
  },
}

export function App() {
  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
      <Button onClick={() => form.submit(console.log)}>Submit</Button>
    </FormProvider>
  )
}
```

## Runtime Flow

1. `createForm()` creates the `Form` instance and wires `effects`, `handlers`, and `onError`.
2. `FormProvider` exposes `form`, `components`, and `decorators` through React context.
3. `SchemaField` calls `form.setSchema(schema)` inside `useEffect`, rebuilding the field registry and reactions.
4. `FieldRenderer` and `ArrayFieldRenderer` read field state and pass the normalized props into UI components.
5. `form.submit()` runs `validate()` first, then returns `form.values`, applying `x-format.output` on the way out.

## Package Responsibilities

| Package | Current responsibility |
| --- | --- |
| `@formily-bao/core` | `Form`, `Field`, schema protocol, expressions, validation, array operations |
| `@formily-bao/react` | `FormProvider`, `SchemaField`, `useForm`, `useField`, `useFormState`, `useArrayField` |
| `@formily-bao/ui` | Default widgets such as `Input`, `Select`, `Checkbox`, `ArrayCards`, `FormGrid`, and `FormSection` |

## Where To Go Next

- Model layer: [Core API](../api/core)
- Rendering layer: [React API](../api/react)
- Protocol fields: [Schema API](../api/schema)
- Component registration: [Components API](../api/components)
