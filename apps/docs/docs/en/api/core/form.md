# Form

## Description

This page documents the `IForm` runtime object returned by `createForm()`.

`@alien-form/core` no longer exposes `Form` as a public class export. Application code should create form instances through the factory and treat `IForm` as the stable public contract.

```ts
import { createForm } from "@alien-form/core";

const form = createForm({
  initialValues: {
    username: "alien",
  },
});
```

## createForm

### Signature

```ts
function createForm(config?: FormConfig): IForm;
```

`createForm` returns a long-lived headless form runtime. It is not a plain data snapshot; it can be read, written, validated, submitted, and subscribed to.

### Minimal Example

```ts
import { createForm } from "@alien-form/core";

const form = createForm();

form.setSchema({
  type: "object",
  properties: {
    username: {
      type: "string",
      title: "Username",
      component: "Input",
      required: true,
    },
  },
});

form.setValues({ username: "alien" });

console.log(form.values);
// { username: "alien" }
```

## Core Properties

| Property | Type | Description |
| --- | --- | --- |
| `fields` | `Map<string, IField>` | registered field instances keyed by field path |
| `values` | `Record<string, any>` | output value snapshot after visibility filtering, array normalization, and `x-format.output` |
| `initialValues` | `Record<string, any>` | reset baseline used by `reset()` |
| `valid` | `boolean` | whether all visible fields currently pass validation |
| `invalid` | `boolean` | inverse of `valid` |
| `submitting` | `boolean` | `true` while `submit()` is running |
| `errors` | `FieldError[]` | flattened visible-field errors |

## Main Methods

### Field access and state updates

| Method | Signature | Description |
| --- | --- | --- |
| `createField` | `(path: string, schema: IFieldSchema, initialValue?: any) => IField` | manually create a field, mostly for low-level use or tests |
| `getField` | `(path: string) => IField \| undefined` | read a field instance by path |
| `setFieldState` | `(path: string, setter: (state: Partial<FieldMutableState>) => void) => void` | imperatively adjust field state |

### Values and schema

| Method | Signature | Description |
| --- | --- | --- |
| `setValues` | `(values: Record<string, any>) => void` | batch-write values into registered fields and apply `x-format.input` |
| `setInitialValues` | `(values: Record<string, any>) => void` | update the reset baseline |
| `reset` | `() => void` | restore current fields to their initial values and replay related derivations |
| `setSchema` | `(schema: IFormSchema) => void` | rebuild the field tree, rules, and derivation graph from schema |

### Validation and submission

| Method | Signature | Description |
| --- | --- | --- |
| `validate` | `() => Promise<boolean>` | validate all visible fields and return `true` when all pass |
| `submit` | `<T = any>(onSubmit?: (values: Record<string, any>) => T \| Promise<T>) => Promise<T>` | validate first, then run the submit callback; returns `form.values` when no callback is passed |
| `destroy` | `() => void` | release cleanup registered from `setup`, plus runtime effect and error listeners |

### Arrays and reactive APIs

| Method | Signature | Description |
| --- | --- | --- |
| `getArrayField` | `(path: string) => IField \| undefined` | get an array field instance |
| `removeArrayItem` | `(arrayPath: string, index: number) => void` | remove a row from an array field |
| `subscribe` | `(listener: () => void) => () => void` | low-level subscription API for bridge layers |
| `effect` | `(runner) => () => void` or `(selector, listener, options?) => () => void` | register reactive side effects based on dependency reads |
| `onError` | `(listener: (error: FormError) => void) => () => void` | subscribe to non-fatal runtime errors |

Array fields themselves also expose `push()`, `remove()`, `moveUp()`, and `moveDown()`. See [Field](./field).

## Using form inside setup

`setup` receives the same `IForm` instance. Use it as the place to register derivation rules, bridge external systems, and centralize cleanup, not as a large imperative workflow container.

```ts
const form = createForm({
  setup(form) {
    const stopValues = form.effect((instance) => instance.values, (values) => {
      console.log("values changed", values);
    });

    const stopName = form.effect(
      (instance) => instance.getField("username")?.value,
      (value) => {
        console.log("username changed", value);
      },
    );

    const stopError = form.onError((error) => {
      console.warn(error.scope, error.path, error.message);
    });

    return () => {
      stopValues();
      stopName();
      stopError();
    };
  },
});
```

### Recommended

- `form.effect(runner)`: rerun based on dependency reads
- `form.effect(selector, listener, options?)`: observe selector value changes
- `form.onError(listener)`: collect non-fatal errors from reactions, formatting, validation, and `$ref` resolution
- `form.getField(path)`: read field instances inside callbacks
- `form.setFieldState(path, setter)`: apply small imperative state corrections
- `form.setValues(values)`: hydrate external data

### Use with caution

- `form.setSchema(schema)`: clears and rebuilds the previous field tree
- `form.createField(path, schema, value)`: can bypass schema protocol boundaries
- `form.reset()`: replays value changes and related effects
- unconditional `setValues()` inside `effect()`: can create loops

## Preferred Side-Effect Model

AlienForm standardizes on `setup + form.effect(...)` for complex derivation instead of path-event style APIs.

```ts
createForm({
  setup(form) {
    return form.effect(
      (instance) => instance.getField("profile")?.value,
      (nextProfile, prevProfile) => {
        console.log("profile changed", nextProfile, prevProfile);
      },
      {
        immediate: true,
        equals: (prev, next) => JSON.stringify(prev) === JSON.stringify(next),
      },
    );
  },
});
```

## Output Value Boundary

`form.values` is not a plain copy of raw field values. It:

1. skips fields with `display === "none"`.
2. skips `void` layout nodes.
3. skips array child paths and lets array fields emit the row array.
4. applies `x-format.output` before returning values.

Inside a `computed` handler, `context.values` is the raw internal value snapshot. Reading `form.values` gives you the output-formatted value object.

## Notes

- `setSchema()` rebuilds fields, rules, and derivation state from scratch.
- `setInitialValues()` only updates the reset baseline; edit hydration usually pairs it with `setValues()`.
- `setValues()` only writes into already registered fields; it does not create fields before schema exists.
- `values` is derived state, so do not mutate `form.values.xxx` directly.
- `submit()` throws on validation failure and attaches the message array to `error.messages`.
- If an `effect()` writes values back into the form, keep the callback convergent to avoid loops.
