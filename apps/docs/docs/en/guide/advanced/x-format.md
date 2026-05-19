# x-format

`x-format` describes how a value is transformed before it enters a field and before it is emitted from the form. It is about input-state and output-state value conversion, not visibility or UI state.

Typical cases include:

- the backend stores cents while the page displays yuan or dollars
- the API uses numeric enums while the component uses semantic strings
- values must be normalized on both read and submit, such as trimming or uppercasing

## Actual Shape

In the current implementation, `x-format` has only two entry points: `input` and `output`.

```json
{
  "x-format": {
    "input": {
      "type": "expression",
      "expression": "$value / 100"
    },
    "output": {
      "type": "expression",
      "expression": "Number($value) * 100"
    }
  }
}
```

Both `input` and `output` use the same rule model as `x-reaction`:

- `static`
- `expression`
- `match`
- `computed`

## Execution Timing

This is the most common source of misunderstanding.

### The actual timing of input

`input` only runs in these situations:

1. during field creation, when processing `default` or `initialValues`
2. when calling `form.setValues()`

It does **not** automatically run on every normal UI keystroke.

In other words, direct user typing goes through `field.setValue()` by default and does not re-enter `x-format.input`. Any documentation claiming that input formatting runs on every keystroke would not match the current implementation.

### The actual timing of output

`output` runs when:

1. reading `form.values`
2. calling `form.submit()`

So `output` is effectively a submission-time conversion rather than an editing-time conversion.

## Typical Patterns

### 1. Currency conversion

This example comes directly from the project demo: the backend stores cents while the page displays yuan.

```json
{
  "type": "number",
  "title": "Amount (displayed in yuan, submitted in cents)",
  "default": 12345,
  "x-format": {
    "input": {
      "type": "expression",
      "expression": "$value / 100"
    },
    "output": {
      "type": "expression",
      "expression": "Number($value) * 100"
    }
  }
}
```

The actual behavior is:

- `default: 12345` is processed by `input` during field creation, so the page shows `123.45`
- when reading `form.values` or submitting the form, `output` converts it back to `12345`

### 2. Enum mapping

```json
{
  "x-format": {
    "input": {
      "type": "match",
      "match": {
        "1": "enabled",
        "0": "disabled",
        "default": "disabled"
      }
    },
    "output": {
      "type": "match",
      "match": {
        "enabled": 1,
        "disabled": 0,
        "default": 0
      }
    }
  }
}
```

In `x-format`, `match` uses the current `$value` as the default match source, so `source` is not required for simple value mapping.

### 3. Delegate complex formatting to a handler

```json
{
  "x-format": {
    "input": {
      "type": "computed",
      "handler": "normalizeCode"
    },
    "output": {
      "type": "computed",
      "handler": "normalizeCode"
    }
  }
}
```

```ts
const form = createForm({
  handlers: {
    normalizeCode: ({ value }) => String(value ?? '').trim().toUpperCase(),
  },
})
```

## Pipeline Behavior

`x-format` supports rule arrays, and it behaves like a real pipeline.

That means:

- the output of the first rule becomes the next rule's `$value`
- the output of the second rule becomes the third rule's `$value`
- the final result is the output of the last rule

This is different from `x-validate`, which accumulates errors instead of transforming values through a pipeline.

## Synchronous Only

In the current implementation, `x-format` must stay synchronous.

If any `x-format` rule returns a Promise, the runtime throws immediately instead of awaiting it. This means:

- remote requests do not belong in `x-format`
- async lookup is not part of value formatting
- when data must be fetched asynchronously, use `x-reaction.dataSource` or surrounding business logic instead

## When To Use x-format

Good fits:

- bidirectional mapping between API values and display values
- protocol conversion for defaults and submit payloads
- synchronous normalization such as trim, uppercase, enum mapping, and currency conversion

Bad fits:

- realtime formatting behavior on every keystroke
- UI linkage between fields
- async remote transformation

If you need immediate formatting while the user types, that behavior usually belongs inside a custom component adapter rather than `x-format.input`.
