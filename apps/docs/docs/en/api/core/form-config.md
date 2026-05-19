# FormConfig

## Description

`FormConfig` is the configuration object passed to `createForm(config)`. It configures initial values, expression scope, `computed` handlers, runtime error handling, and form effects.

```ts
import { createForm } from '@alien-form/core'

const form = createForm({
  initialValues: {
    province: 'zhejiang'
  },
  scope: {
    readonlyMode: 'readonly'
  },
  handlers: {
    async loadCities(ctx) {
      return fetchCities(ctx.deps.province)
    }
  },
  effects(form) {
    form.onValuesChange((values) => {
      console.log(values)
    })
  },
  onError(error) {
    console.warn(error)
  }
})
```

## Signature

```ts
interface FormConfig {
  initialValues?: Record<string, any>
  validateFirst?: boolean
  effects?: (form: IForm) => void
  scope?: Record<string, any>
  handlers?: Record<string, RuntimeRuleHandler>
  onError?: (error: FormError) => void
}
```

## Options

| Option | Type | Description |
| --- | --- | --- |
| `initialValues` | `Record<string, any>` | initial field values, read by path when fields are created |
| `validateFirst` | `boolean` | reserved in types; the current validation implementation does not fully enforce short-circuit behavior |
| `effects` | `(form: IForm) => void` | setup hook executed during form construction |
| `scope` | `Record<string, any>` | custom variables injected into expression and rule runtime scope |
| `handlers` | `Record<string, RuntimeRuleHandler>` | registry for business handlers called by `computed` rules |
| `onError` | `(error: FormError) => void` | listener for non-fatal runtime errors |

## initialValues

`initialValues` is used as the initial value source when `setSchema()` creates fields.

```ts
const form = createForm({
  initialValues: {
    user: {
      name: 'Alice'
    }
  }
})

form.setSchema({
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          component: 'Input'
        }
      }
    }
  }
})

form.getField('user.name')?.value
// 'Alice'
```

Note: `setInitialValues()` only updates the reset baseline. It does not write into current field values. For edit hydration, usually call both:

```ts
form.setInitialValues(detail)
form.setValues(detail)
```

## scope

`scope` is merged into the runtime scope used by expression rules. It is suitable for enums, constants, and readonly contextual data. Function calls do not belong in `expression`; put them in `computed` handlers.

```ts
const form = createForm({
  scope: {
    adultAge: 18
  }
})
```

Then read it from schema expressions:

```ts
{
  type: 'expression',
  dependencies: { age: 'age' },
  expression: '$deps.age >= adultAge ? "visible" : "none"'
}
```

`expression` is executed by a restricted interpreter. It supports literals, variable reads, property/index access, object/array literals, arithmetic/comparison/logical operators, and ternary expressions. It does not support function calls, assignments, statements, `new`, `eval`, `Function`, `constructor`, `prototype`, or `__proto__`.

Built-in scope variables:

| Variable | Description |
| --- | --- |
| `$self` | current field instance; may be `undefined` in some value-formatting phases |
| `$form` | current form instance |
| `$values` | current values object; output values in reactions, raw internal values in format/validate |
| `$deps` | dependency values resolved from `dependencies`; array for array dependencies, object for object dependencies |
| `$dependencies` | object-form dependency values resolved from `dependencies` |
| `$value` | current field value or current value in a formatting chain |

## handlers

`handlers` receive `computed` rules. AlienForm does not put async requests, side effects, authentication, or caching strategy into schema. Instead, schema references a handler by name.

```ts
const form = createForm({
  handlers: {
    async loadCities(ctx) {
      return requestCities(ctx.deps.province)
    }
  }
})
```

Reference it from schema:

```ts
{
  type: 'string',
  component: 'Select',
  'x-reaction': {
    dataSource: {
      type: 'computed',
      dependencies: { province: 'province' },
      handler: 'loadCities'
    }
  }
}
```

### RuntimeRuleHandlerContext

```ts
interface RuntimeRuleHandlerContext {
  field: IField
  form: IForm
  values: Record<string, any>
  deps: Record<string, any>
  dependencies: Record<string, any>
  scope: Record<string, any>
  key: SchemaReactionKey | 'input' | 'output' | 'validate' | string
  rule: SchemaXRule
  value?: any
  kind?: 'x-reaction' | 'x-format' | 'x-validate'
}
```

| Field | Description |
| --- | --- |
| `field` | field that owns the current rule |
| `form` | current form instance, useful for reading fields, values, and errors |
| `values` | current raw internal value snapshot; does not run `x-format.output` |
| `deps` | dependency value object; same as `dependencies` |
| `dependencies` | dependency values resolved from `rule.dependencies` |
| `scope` | full expression scope including built-ins and custom `scope` |
| `key` | target key of the current rule; reaction target, `input/output` for format, or `validate` for validation |
| `rule` | current rule object; use `rule.params` for custom parameters |
| `value` | current field value or current value in a formatting chain |
| `kind` | source of the rule: `x-reaction`, `x-format`, or `x-validate` |

### Handler Return Contract

| Location | Return value | Async | Notes |
| --- | --- | --- | --- |
| `x-reaction` | target property value | yes | Promise results are awaited and field `loading` is maintained automatically |
| `x-format.input` | converted input value | no / currently errors | formatting is synchronous, so returning a Promise is invalid |
| `x-format.output` | converted output value | no / currently errors | `form.values` is a synchronous getter, so returning a Promise is invalid |
| `x-validate` | error message, error array, or empty value | yes | return value is normalized into `FieldError[]` |

## effects

`effects` runs synchronously during `Form` construction and receives the current `form` instance. It is suitable for registering subscriptions, error listeners, and lifecycle callbacks.

```ts
const form = createForm({
  effects(form) {
    form.onValuesChange((values) => {
      console.log('values changed', values)
    })

    form.onFieldChange('*', (field) => {
      console.log('field changed', field.path)
    })
  }
})
```

### Methods Available in effects

Commonly used:

- `form.onValuesChange(listener)`
- `form.onFieldChange(path, listener)`
- `form.onError(listener)`
- `form.getField(path)`
- `form.setFieldState(path, setter)`
- `form.setValues(values)`
- `form.validate()`
- `form.submit(onSubmit)`

Available but use with caution:

- `form.setSchema(schema)`: rebuilds the field tree.
- `form.createField(path, schema, value)`: usually avoid bypassing schema-driven creation.
- `form.reset()`: emits value changes and replays reactions.
- Calling `setValues()` inside `onValuesChange()`: guard it with conditions to avoid loops.

### onLifecycle

`form.onLifecycle(event, path, handler)` subscribes to field lifecycle events and is now part of the public `IForm` API.

```ts
createForm({
  effects(form) {
    form.onLifecycle('onFieldValidateFailed', '*', (field) => {
      console.log('validate failed', field.path)
    })
  }
})
```

Supported events:

- `onFieldInit`
- `onFieldMount`, reserved; core does not actively emit it yet
- `onFieldUnmount`, reserved; core does not actively emit it yet
- `onFieldValueChange`
- `onFieldInputValueChange`
- `onFieldInitialValueChange`, reserved; core does not actively emit it yet
- `onFieldValidateStart`
- `onFieldValidateEnd`
- `onFieldValidateFailed`
- `onFieldValidateSuccess`

## onError

When non-fatal runtime errors occur in reactions, formatting, validation, `$ref` resolution, and similar flows, they are emitted through `onError`.

```ts
interface FormError {
  scope: FormErrorScope
  path: string
  key?: string
  message: string
  cause?: unknown
}
```

Supported `scope` values:

- `reaction`
- `x-reaction`
- `x-format`
- `x-validate`
- `ref-resolve`
- `expression`

If no `onError` or `form.onError()` listener is registered, the runtime falls back to `console.warn`.
