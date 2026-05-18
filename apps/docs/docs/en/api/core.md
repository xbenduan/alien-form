# Core API

## createForm

```ts
import { createForm } from '@formily-bao/core'

const form = createForm({
  initialValues: {},
  handlers: {
    fetchUsers: async ({ deps }) => [{ label: 'Alice', value: 'alice' }],
  },
})
```

## FormConfig

| Field | Type | Description |
| --- | --- | --- |
| `initialValues` | `Record<string, any>` | Initial values |
| `validateFirst` | `boolean` | Stop on first validation error |
| `effects` | `(form) => void` | Form effect registration |
| `scope` | `Record<string, any>` | Custom variables visible to safe expressions |
| `handlers` | `Record<string, RuntimeRuleHandler>` | Handler registry for `computed` x-reaction |

## RuntimeRuleHandler

```ts
type RuntimeRuleHandler = (context: {
  field: IField
  form: IForm
  values: Record<string, any>
  deps: Record<string, any>
  dependencies: Record<string, any>
  scope: Record<string, any>
  key: string
  rule: SchemaXRule
}) => any | Promise<any>
```
