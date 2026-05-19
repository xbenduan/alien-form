# x-validate

`x-validate` describes dynamic validation logic. Unlike static `validators`, it supports expressions, cross-field dependencies, and complex or async validation through handlers.

## Actual Shape

In the current implementation, `x-validate` itself is a `SchemaRuleSet`, which means it can be either a single rule or an array of rules.

```json
{
  "x-validate": {
    "type": "expression",
    "dependencies": {
      "password": "password"
    },
    "expression": "$value === $deps.password ? undefined : 'Passwords do not match'"
  }
}
```

It supports only the same four rule types:

- `static`
- `expression`
- `match`
- `computed`

## Execution Timing

`x-validate` does not run automatically on every keystroke.

In the current implementation, it only runs when:

- `field.validate()` is called
- `form.validate()` is called
- `form.submit()` is called

So if you want realtime validation during typing, the UI layer or surrounding interaction logic must trigger validation explicitly.

## Validation Order

The validation flow for a field is fixed:

1. if `display === 'none'`, the field is skipped
2. run `required`
3. run static `validators`
4. run `x-validate`

That means `x-validate` is a dynamic extension layer on top of built-in validators, not a total replacement.

## Typical Patterns

### 1. Expression validation

```json
{
  "type": "string",
  "title": "Username",
  "x-validate": {
    "type": "expression",
    "expression": "$value === 'admin' ? undefined : 'Username must be admin'"
  }
}
```

In the current implementation:

- `undefined` / `null` / `true` means pass
- `false` means fail without a specific message
- `string` becomes an error message
- `object` or `array` is normalized into `FieldError[]`

### 2. Cross-field validation

```json
{
  "type": "string",
  "title": "Confirm Password",
  "x-validate": {
    "type": "expression",
    "dependencies": {
      "password": "password"
    },
    "expression": "$value === $deps.password ? undefined : 'Passwords do not match'"
  }
}
```

This is a strong fit for:

- password confirmation
- start/end time comparison
- min/max cross-field constraints
- business consistency checks across fields

### 3. Async validation

```json
{
  "type": "string",
  "title": "Async Confirmation Code",
  "x-validate": {
    "type": "computed",
    "handler": "checkConfirmCode"
  }
}
```

```ts
const form = createForm({
  handlers: {
    checkConfirmCode: async ({ value }) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return value === "OK" ? undefined : "Confirmation code must be OK";
    },
  },
});
```

This shows the correct pattern in the current project: advanced dynamic validation should live in `handlers`, not as inline runtime functions embedded in the schema.

## Handler Context

A `computed` validation handler receives a context object rather than a raw value. Available fields include:

- `field`
- `form`
- `values`
- `deps`
- `dependencies`
- `scope`
- `key`
- `rule`
- `value`
- `kind`

Important details:

- `values` is the raw value snapshot, not the `x-format.output` result
- `deps` contains dependency values
- `kind` is `x-validate` in this case

## Rule Array Behavior

`x-validate` also supports arrays:

```json
{
  "x-validate": [
    {
      "type": "expression",
      "expression": "$value ? undefined : 'Required'"
    },
    {
      "type": "expression",
      "expression": "$value.length >= 6 ? undefined : 'At least 6 characters'"
    }
  ]
}
```

Array rules run in sequence and accumulate all errors.

This is not a transformation pipeline like `x-format`. Every validation rule still sees the same current field value.

## Visibility Boundary

Fields with `display: 'none'` do not participate in validation.

That means once a field is truly removed from the visible runtime surface:

- it does not appear in `form.values`
- it is skipped by `form.validate()`

Fields with `display: 'hidden'` still participate in value output and validation, which is fundamentally different from `none`.

## When To Use x-validate

Good fits:

- validation that depends on other fields
- business-rule validation
- validation that requires async requests
- rules that cannot be described by static `validators` alone

Bad fits:

- moving every simple required, length, and regex rule into `x-validate`
- mixing UI interaction behavior into validation expressions
- embedding runtime functions directly inside the schema

Use `validators` first for simple rules. Reach for `x-validate` only when the rule genuinely depends on runtime context.
