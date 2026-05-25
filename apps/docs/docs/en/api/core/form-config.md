# FormConfig

## Description

`FormConfig` is the configuration object passed to `createForm(config)`. It configures initial values, expression scope, `computed` handlers, runtime error handling, and the signals-style form side-effect entry.

```ts
import { createForm } from "@alien-form/core";

const form = createForm({
  initialValues: {
    province: "zhejiang",
  },
  scope: {
    readonlyMode: "readonly",
  },
  handlers: {
    async loadCities(ctx) {
      return fetchCities(ctx.deps.province);
    },
  },
  setup(form) {
    return form.watchValues((values) => {
      console.log(values);
    });
  },
  onError(error) {
    console.warn(error);
  },
});
```

## Signature

```ts
interface FormConfig {
  initialValues?: Record<string, any>;
  validateFirst?: boolean;
  setup?: (form: IForm) => void | (() => void);
  scope?: Record<string, any>;
  handlers?: Record<string, RuntimeRuleHandler>;
  onError?: (error: FormError) => void;
}
```

## Options

| Option          | Type                                 | Description                                                                                            |
| --------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `initialValues` | `Record<string, any>`                | initial field values, read by path when fields are created                                             |
| `validateFirst` | `boolean`                            | reserved in types; the current validation implementation does not fully enforce short-circuit behavior |
| `setup`         | `(form: IForm) => void \| (() => void)` | setup hook executed during form construction and may return a disposer                                 |
| `scope`         | `Record<string, any>`                | custom variables injected into expression and rule runtime scope                                       |
| `handlers`      | `Record<string, RuntimeRuleHandler>` | registry for business handlers called by `computed` rules                                              |
| `onError`       | `(error: FormError) => void`         | listener for non-fatal runtime errors                                                                  |

## initialValues

`initialValues` is used as the initial value source when `setSchema()` creates fields.

```ts
const form = createForm({
  initialValues: {
    user: {
      name: "Alice",
    },
  },
});

form.setSchema({
  type: "object",
  properties: {
    user: {
      type: "object",
      properties: {
        name: {
          type: "string",
          component: "Input",
        },
      },
    },
  },
});

form.getField("user.name")?.value;
// 'Alice'
```

Note: `setInitialValues()` only updates the reset baseline. It does not write into current field values. For edit hydration, usually call both:

```ts
form.setInitialValues(detail);
form.setValues(detail);
```

## scope

`scope` is merged into the runtime scope used by expression rules. It is suitable for enums, constants, and readonly contextual data. Function calls do not belong in `expression`; put them in `computed` handlers.

```ts
const form = createForm({
  scope: {
    adultAge: 18,
  },
});
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

| Variable        | Description                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| `$self`         | current field instance; may be `undefined` in some value-formatting phases                                   |
| `$form`         | current form instance                                                                                        |
| `$values`       | current values object; output values in reactions, raw internal values in format/validate                    |
| `$deps`         | dependency values resolved from `dependencies`; array for array dependencies, object for object dependencies |
| `$dependencies` | object-form dependency values resolved from `dependencies`                                                   |
| `$value`        | current field value or current value in a formatting chain                                                   |

## handlers

`handlers` receive `computed` rules. AlienForm does not put async requests, side effects, authentication, or caching strategy into schema. Instead, schema references a handler by name.

```ts
const form = createForm({
  handlers: {
    async loadCities(ctx) {
      return requestCities(ctx.deps.province);
    },
  },
});
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
  field: IField;
  form: IForm;
  values: Record<string, any>;
  deps: Record<string, any>;
  dependencies: Record<string, any>;
  scope: Record<string, any>;
  key: SchemaReactionKey | "input" | "output" | "validate" | string;
  rule: SchemaXRule;
  value?: any;
  kind?: "x-reaction" | "x-format" | "x-validate";
}
```

| Field          | Description                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `field`        | field that owns the current rule                                                                         |
| `form`         | current form instance, useful for reading fields, values, and errors                                     |
| `values`       | current raw internal value snapshot; does not run `x-format.output`                                      |
| `deps`         | dependency value object; same as `dependencies`                                                          |
| `dependencies` | dependency values resolved from `rule.dependencies`                                                      |
| `scope`        | full expression scope including built-ins and custom `scope`                                             |
| `key`          | target key of the current rule; reaction target, `input/output` for format, or `validate` for validation |
| `rule`         | current rule object; use `rule.params` for custom parameters                                             |
| `value`        | current field value or current value in a formatting chain                                               |
| `kind`         | source of the rule: `x-reaction`, `x-format`, or `x-validate`                                            |

### Handler Return Contract

| Location          | Return value                               | Async                 | Notes                                                                       |
| ----------------- | ------------------------------------------ | --------------------- | --------------------------------------------------------------------------- |
| `x-reaction`      | target property value                      | yes                   | Promise results are awaited and field `loading` is maintained automatically |
| `x-format.input`  | converted input value                      | no / currently errors | formatting is synchronous, so returning a Promise is invalid                |
| `x-format.output` | converted output value                     | no / currently errors | `form.values` is a synchronous getter, so returning a Promise is invalid    |
| `x-validate`      | error message, error array, or empty value | yes                   | return value is normalized into `FieldError[]`                              |

## setup

`setup` runs synchronously during `Form` construction and receives the current `form` instance. It is suitable for registering `watch`, `effect`, error listeners, and cleanup logic released by `form.destroy()`.

```ts
const form = createForm({
  setup(form) {
    const stopValues = form.watchValues((values) => {
      console.log("values changed", values);
    });

    const stopName = form.watchFieldValue("name", (value) => {
      console.log("name changed", value);
    });

    return () => {
      stopValues();
      stopName();
    };
  },
});
```

### Methods Available in setup

Commonly used:

- `form.effect(runner)`
- `form.watch(selector, listener, options?)`
- `form.watchFieldValue(path, listener, options?)`
- `form.watchValues(listener, options?)`
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
- Calling `setValues()` inside `watchValues()` or `effect()`: guard it with conditions to avoid loops.

### Signals-style side effects

Prefer these entry points:

- `form.effect(runner)`: when you only care about dependency reads and reruns.
- `form.watch(selector, listener, options?)`: when you need a selector with previous value and custom equality.
- `form.watchFieldValue(path, listener, options?)`: when you want to observe a field's aggregate value, especially for object/array fields.

For example:

```ts
createForm({
  setup(form) {
    return form.watch(
      (instance) => instance.getField("specs")?.value,
      (nextSpecs, prevSpecs) => {
        console.log("specs changed", nextSpecs, prevSpecs);
      },
      {
        immediate: true,
        equals: (prev, next) => JSON.stringify(prev) === JSON.stringify(next),
      },
    );
  },
});
```

## onError

When non-fatal runtime errors occur in reactions, formatting, validation, `$ref` resolution, and similar flows, they are emitted through `onError`.

```ts
interface FormError {
  scope: FormErrorScope;
  path: string;
  key?: string;
  message: string;
  cause?: unknown;
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
