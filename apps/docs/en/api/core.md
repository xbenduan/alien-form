# Core API

## createForm

```ts
import { createForm } from '@formily-bao/core'

const form = createForm({
  initialValues: {},
  reactionHandlers: {
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
| `reactionHandlers` | `Record<string, ReactionHandler>` | Handler registry for `computed` reactions |

## ReactionHandler

```ts
type ReactionHandler = (context: {
  field: IField
  form: IForm
  values: Record<string, any>
  deps: Record<string, any>
  dependencies: Record<string, any>
  scope: Record<string, any>
  key: string
  rule: SchemaReactionRule
}) => any | Promise<any>
```
