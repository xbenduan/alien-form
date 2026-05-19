# Form

## Description

`Form` is the top-level runtime model in `@alien-form/core`. It owns the field registry, schema setup, values, submission state, validation entry points, array field operations, and subscriptions.

In most cases, you create it with `createForm(options)` instead of calling `new Form()` directly.

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

`createForm` returns an `IForm` instance. The return value is not a plain data object, but a long-lived form model that can be read, written, validated, submitted, and subscribed to.

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
// { username: 'alien' }
```

## Available Members Returned by createForm

### Core Properties

| Property        | Type                  | Description                                                                                                  |
| --------------- | --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `fields`        | `Map<string, IField>` | registered field instances keyed by field path                                                               |
| `values`        | `Record<string, any>` | output values; excludes invisible fields, void fields, and array child paths, then applies `x-format.output` |
| `initialValues` | `Record<string, any>` | initial snapshot used by `reset()`                                                                           |
| `valid`         | `boolean`             | whether all visible fields currently have no errors                                                          |
| `invalid`       | `boolean`             | inverse of `valid`                                                                                           |
| `submitting`    | `boolean`             | `true` while `submit()` is running                                                                           |
| `errors`        | `FieldError[]`        | flattened errors from visible fields                                                                         |

### Field Creation and Access

| Method          | Signature                                                                     | Description                                                         |
| --------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `createField`   | `(path: string, schema: IFieldSchema, initialValue?: any) => IField`          | manually create a field; usually called internally by `setSchema()` |
| `getField`      | `(path: string) => IField \| undefined`                                       | read a field instance by path                                       |
| `setFieldState` | `(path: string, setter: (state: Partial<FieldMutableState>) => void) => void` | update field state with a state setter callback                     |

### Value Operations

| Method             | Signature                               | Description                                                       |
| ------------------ | --------------------------------------- | ----------------------------------------------------------------- |
| `setValues`        | `(values: Record<string, any>) => void` | batch-write values into existing fields; applies `x-format.input` |
| `setInitialValues` | `(values: Record<string, any>) => void` | update the reset baseline; does not rewrite current field values  |
| `reset`            | `() => void`                            | restore fields to initial values and replay reactions             |

### Validation and Submission

| Method     | Signature                                                                              | Description                                                                                     |
| ---------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `validate` | `() => Promise<boolean>`                                                               | validate all visible fields and return `true` when all pass                                     |
| `submit`   | `<T = any>(onSubmit?: (values: Record<string, any>) => T \| Promise<T>) => Promise<T>` | validate first, then call the submit callback; returns `form.values` when no callback is passed |

### Schema Operations

| Method      | Signature                       | Description                                                     |
| ----------- | ------------------------------- | --------------------------------------------------------------- |
| `setSchema` | `(schema: IFormSchema) => void` | rebuild field tree, formatting rules, and reactions from schema |

### Array Field Operations

| Method            | Signature                                    | Description                                                |
| ----------------- | -------------------------------------------- | ---------------------------------------------------------- |
| `getArrayField`   | `(path: string) => IField \| undefined`      | return an array field; non-array fields return `undefined` |
| `removeArrayItem` | `(arrayPath: string, index: number) => void` | remove a row from an array field                           |

Array fields themselves also provide `push()`, `remove()`, `moveUp()`, and `moveDown()`. See [Field](./field).

### Subscriptions and Effects

| Method           | Signature                                                         | Description                                               |
| ---------------- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| `subscribe`      | `(listener: () => void) => () => void`                            | subscribe to form-level updates and return a disposer     |
| `onFieldChange`  | `(path: string, listener: (field: IField) => void) => () => void` | subscribe to field state changes; supports `'*'` wildcard |
| `onValuesChange` | `(listener: (values: Record<string, any>) => void) => () => void` | subscribe to output-value changes                         |
| `onError`        | `(listener: (error: FormError) => void) => () => void`            | subscribe to non-fatal runtime errors                     |

## What Can Be Called Inside effects

The `effects` callback receives the same `form` instance returned by `createForm()`, so it can technically call all public methods listed above. In practice, use `effects` mainly for subscriptions and lifecycle registration, not for large imperative business workflows.

```ts
const form = createForm({
  effects(form) {
    const disposeValue = form.onValuesChange((values) => {
      console.log("values changed", values);
    });

    const disposeField = form.onFieldChange("username", (field) => {
      console.log("username changed", field.value);
    });

    const disposeError = form.onError((error) => {
      console.warn(error.scope, error.path, error.message);
    });
  },
});
```

### Recommended in effects

| Method             | Usage                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| `onValuesChange()` | listen to output value changes for telemetry, debugging, or external state sync   |
| `onFieldChange()`  | listen to one field or all field state changes                                    |
| `onError()`        | collect runtime errors from reactions, formatting, validation, and ref resolution |
| `getField()`       | read field instances inside callbacks                                             |
| `setFieldState()`  | apply small imperative field state corrections inside callbacks                   |
| `setValues()`      | hydrate values after initialization or after external data arrives                |
| `validate()`       | trigger validation from an external flow                                          |
| `submit()`         | reuse form validation and output-value logic from an external submit action       |

### Use with caution in effects

| Method          | Reason                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `setSchema()`   | clears and rebuilds fields and reactions; avoid calling it inside frequently triggered subscriptions |
| `createField()` | schema-driven creation is preferred; manual fields can bypass protocol structure                     |
| `reset()`       | replays value changes and reactions; avoid calling it unguarded from value-change listeners          |
| `setValues()`   | useful, but do not call it unconditionally inside `onValuesChange()` or you may create a loop        |

## Lifecycle Subscription: onLifecycle

`onLifecycle(event, path, handler)` is the public field lifecycle subscription API and is declared on `IForm`. It is suitable for registering field initialization, value-change, and validation-stage callbacks inside `effects`.

```ts
createForm({
  effects(form) {
    form.onLifecycle("onFieldInit", "*", (field, form) => {
      console.log("field init", field.path);
    });
  },
});
```

Supported events:

| Event                       | Trigger                                              |
| --------------------------- | ---------------------------------------------------- |
| `onFieldInit`               | after a field is created                             |
| `onFieldMount`              | reserved; core does not actively emit it yet         |
| `onFieldUnmount`            | reserved; core does not actively emit it yet         |
| `onFieldValueChange`        | when a field value changes                           |
| `onFieldInputValueChange`   | currently emitted together with `onFieldValueChange` |
| `onFieldInitialValueChange` | reserved; core does not actively emit it yet         |
| `onFieldValidateStart`      | before field validation starts                       |
| `onFieldValidateEnd`        | after field validation ends                          |
| `onFieldValidateFailed`     | when field validation fails                          |
| `onFieldValidateSuccess`    | when field validation succeeds                       |

`path` supports exact field paths and the `'*'` wildcard.

## Output Value Boundary

`form.values` is not a plain copy of all raw field values. It applies these rules:

1. Skip fields with `display === 'none'`.
2. Skip `void` layout nodes.
3. Skip array child paths; array fields output the row array instead.
4. Apply `x-format.output` before returning values.

Inside a `computed` handler, `context.values` is the current raw internal value snapshot. Reading `form.values` returns the output-formatted value object.

## Notes

- `setSchema()` clears old fields, reactions, and formatting rules before rebuilding.
- `setInitialValues()` only updates the reset baseline; it does not rewrite current field values by itself, so edit hydration usually pairs it with `setValues()`.
- `setValues()` only writes to fields that already exist. If no schema has been set, it will not create fields.
- `values` is derived. Do not mutate `form.values.xxx` directly.
- `submit()` throws when validation fails and attaches an array of messages to `error.messages`.
- `onFieldChange('*', listener)` can observe all field changes, but be careful with callback cost in large forms.
