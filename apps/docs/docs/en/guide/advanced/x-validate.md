# x-validate

`x-validate` describes dynamic validation logic. Unlike the built-in `validate` object, it supports expressions, cross-field dependencies, and complex or async validation through handlers.

## Actual Shape

`x-validate` is a `SchemaRuleSet` — either a single rule or an array of rules.

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

Rule types: `static` / `expression` / `match` / `computed`. See [Schema Protocol — Rule Model](../schema-protocol#rule-model-schemaxrule).

## Execution Timing

`x-validate` does not run automatically on every keystroke.

It only runs when:

- `field.validate()` is called
- `form.validate()` is called
- `form.submit()` is called

For realtime validation during typing, the UI layer must trigger validation explicitly.

## Validation Pipeline

Field validation has exactly two layers:

1. **`validate`** — built-in static constraints (`required`, `minLength`, `pattern`, etc.).
2. **`x-validate`** — dynamic rules (expression / match / computed).

Fields with `display === 'none'` skip validation entirely.

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

Return value convention:

- `undefined` / `null` / `true` → pass
- `false` → fail (no specific message)
- `string` → error message
- `object` / `array` → normalized into `FieldError[]`

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

Good fits:

- Password confirmation
- Start/end time comparison
- Min/max cross-field constraints
- Business consistency checks

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

Complex dynamic validation belongs in `handlers`, not as inline functions in the schema.

## Handler Context

A `computed` handler receives a context object. See [Schema Protocol — Expression Context](../schema-protocol#expression-context). Key notes: `values` is the raw snapshot (not `x-format.output` result), `kind` is `"x-validate"`.

## Rule Array Behavior

`x-validate` supports arrays:

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

Array rules run in sequence and accumulate all errors. Every rule sees the same field value (not a transformation pipeline).

## Visibility Boundary

- `display: 'none'` → skipped in validation, excluded from `form.values`
- `display: 'hidden'` → still participates in validation and value output

## When To Use x-validate

Good fits:

- Validation that depends on other fields
- Business-rule validation
- Validation requiring async requests
- Rules that cannot be described by `validate` static constraints

Bad fits:

- Moving every simple required/length/regex rule into `x-validate`
- Mixing UI interaction logic into validation expressions
- Embedding runtime functions directly in the schema

Use `validate` for simple constraints. Reach for `x-validate` only when the rule genuinely depends on runtime context.
