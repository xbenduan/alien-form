# Tutorial

Build a registration form step by step using FormBao's actual API.

## 1. Create the Form

`createForm()` accepts a `FormConfig` object:

```ts
import { createForm } from '@formily-bao/core'

const form = createForm({
  initialValues: { role: 'developer' },
  scope: {
    // Custom expression helpers available in reactions
    isDevRole: (role: string) => role === 'developer',
  },
})
```

`FormConfig` fields (from `types.ts`):

- `initialValues` — initial form values
- `validateFirst` — stop on first error
- `effects` — lifecycle hook registration callback
- `scope` — custom variables available in `{{expression}}` syntax
- `services` — async data source function registry
- `transformers` — response transform registry

## 2. Define the Schema

```json
{
  "type": "object",
  "properties": {
    "username": {
      "type": "string",
      "title": "Username",
      "required": true,
      "component": "Input",
      "decorator": "FormItem",
      "validators": [
        { "minLength": 3, "message": "At least 3 characters" },
        { "pattern": "^[a-zA-Z0-9_]+$", "message": "Letters, numbers, underscore only" }
      ]
    },
    "email": {
      "type": "string",
      "title": "Email",
      "required": true,
      "component": "Input",
      "decorator": "FormItem",
      "props": { "type": "email" },
      "validators": [{ "format": "email" }]
    },
    "role": {
      "type": "string",
      "title": "Role",
      "component": "Select",
      "decorator": "FormItem",
      "enum": [
        { "label": "Developer", "value": "developer" },
        { "label": "Designer", "value": "designer" },
        { "label": "Manager", "value": "manager" }
      ]
    },
    "bio": {
      "type": "string",
      "title": "Bio",
      "component": "Textarea",
      "decorator": "FormItem",
      "reactions": {
        "dependencies": { "role": "role" },
        "when": "{{$deps.role === 'developer'}}",
        "fulfill": {
          "schema": {
            "props": { "placeholder": "Tell us about your tech stack..." }
          }
        },
        "otherwise": {
          "schema": {
            "props": { "placeholder": "Tell us about yourself..." }
          }
        }
      }
    }
  }
}
```

## 3. Render with React

```tsx
import { FormProvider, SchemaField } from '@formily-bao/react'
import { Input, Select, Textarea, FormItem } from '@formily-bao/ui'

function RegistrationForm() {
  return (
    <FormProvider
      form={form}
      components={{ Input, Select, Textarea }}
      decorators={{ FormItem }}
    >
      <SchemaField schema={schema} />
      <button onClick={handleSubmit}>Register</button>
    </FormProvider>
  )
}
```

`FormProvider` establishes a `FormContext` that `SchemaField` consumes. `SchemaField` calls `form.setSchema(schema)` on first render, which:

1. Resolves `$ref` references via `_resolveRef()`
2. Sorts properties by `order`
3. Creates `Field` instances with `createField()`
4. Sets up reactive effects for `reactions`
5. Sets up async data source fetchers for `asyncDataSource`

## 4. Submit

```tsx
const handleSubmit = async () => {
  try {
    const values = await form.submit()
    console.log('Success:', values)
  } catch (err) {
    console.error('Validation errors:', err.messages)
  }
}
```

`form.submit()` internally:
1. Calls `form.validate()` — validates all visible fields in parallel
2. If invalid, throws with `err.messages` containing error strings
3. If valid, returns `form.values` (collects from all visible, non-void, non-array-child fields)
