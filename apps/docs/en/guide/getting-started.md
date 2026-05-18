# Getting Started

## Installation

```bash
npm install @formily-bao/core @formily-bao/react @formily-bao/ui
```

## Quick Example

```tsx
import { createForm } from '@formily-bao/core'
import { FormProvider, SchemaField } from '@formily-bao/react'
import { Input, Select, FormItem } from '@formily-bao/ui'

const form = createForm({
  initialValues: { role: 'developer' },
})

const schema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      title: 'Username',
      required: true,
      'component': 'Input',
      'decorator': 'FormItem',
      'validators': [{ minLength: 3, message: 'At least 3 characters' }],
    },
    role: {
      type: 'string',
      title: 'Role',
      'component': 'Select',
      'decorator': 'FormItem',
      enum: [
        { label: 'Developer', value: 'developer' },
        { label: 'Designer', value: 'designer' },
      ],
    },
  },
}

function App() {
  return (
    <FormProvider form={form} components={{ Input, Select }} decorators={{ FormItem }}>
      <SchemaField schema={schema} />
      <button onClick={() => form.submit(console.log)}>Submit</button>
    </FormProvider>
  )
}
```

## How It Works

1. **`createForm()`** creates a reactive form instance backed by Alien Signals.
2. **`FormProvider`** establishes the React context with registered components/decorators.
3. **`SchemaField`** calls `form.setSchema()` internally, which creates `Field` instances for each property and sets up `reactions` effects.
4. Each `Field` stores its state in signals (`_value`, `_display`, `_pattern`, `_errors`, etc.) — only subscribed components re-render on change.

## Architecture

```
JSON Schema (Formily Protocol)
        │
        ▼
┌─────────────────────────────┐
│        Form (form.ts)       │
│  • createField()            │
│  • setSchema() — resolves   │
│    $ref, order, creates   │
│    fields, sets up reactions │
│  • Expression engine        │
│  • Lifecycle registry       │
└──────────────┬──────────────┘
               │ creates
               ▼
┌─────────────────────────────┐
│       Field (field.ts)      │
│  • Alien Signals state      │
│  • validate() with format   │
│    validators               │
│  • Array operations         │
│  • setState() / display /   │
│    pattern control          │
└──────────────┬──────────────┘
               │ consumed by
               ▼
┌─────────────────────────────┐
│      React Layer (react.tsx) │
│  • FormProvider / SchemaField│
│  • useForm / useField       │
│  • FieldRenderer            │
│  • ArrayFieldRenderer       │
└─────────────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@formily-bao/core` | Headless form model, field state, expression engine |
| `@formily-bao/ui` | UI components: Input, Select, Switch, Rating, ArrayCards, FormGrid, etc. |
