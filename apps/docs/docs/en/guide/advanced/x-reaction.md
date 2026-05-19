# x-reaction

`x-reaction` is one of the most important advanced protocols in AlienForm. It derives the runtime state of the current field from dependency values, such as `display`, `pattern`, `title`, `props`, `dataSource`, or `value`.

## Actual Shape

The current project does not support the "single rule plus `target`" style. The real shape is an object keyed by the target property name:

```json
{
  "x-reaction": {
    "display": {
      "type": "match",
      "dependencies": {
        "contactType": "contactType"
      },
      "match": {
        "email": "visible",
        "default": "none"
      }
    },
    "title": {
      "type": "expression",
      "dependencies": {
        "contactType": "contactType"
      },
      "expression": "$deps.contactType === 'email' ? 'Email Address' : 'Contact Method'"
    }
  }
}
```

Key rules to remember:

- the key under `x-reaction` is the property being updated, so there is no standalone `target` field
- the dependency field is named `dependencies`, not `deps`
- `expression` rules use the `expression` field
- `match` rules use the `match` field
- expressions are plain JavaScript expression strings and do not support `{{ ... }}`

## Supported Rule Types

The current implementation only supports four rule types:

| Type | Purpose |
| --- | --- |
| `static` | return a fixed value |
| `expression` | compute a value from an expression |
| `match` | map a dependency value to a branch result |
| `computed` | call a handler registered in `createForm({ handlers })` |

## Supported Target Keys

The runtime explicitly supports the following reaction keys:

- `value`
- `display`
- `visible`
- `hidden`
- `pattern`
- `disabled`
- `readOnly`
- `readPretty`
- `editable`
- `required`
- `title`
- `description`
- `props`
- `decoratorProps`
- `component`
- `decorator`
- `dataSource`

Although the type allows arbitrary strings, unsupported keys only trigger `onError` and will not actually update field state.

## Dependency Resolution

`dependencies` supports two shapes:

```json
{
  "dependencies": ["price", "quantity"]
}
```

Array dependencies are consumed as `$deps[0]`, `$deps[1]`.

```json
{
  "dependencies": {
    "price": "price",
    "quantity": "quantity"
  }
}
```

Object dependencies are consumed as `$deps.price`, `$deps.quantity`.

Relative paths are also supported. For example, array item fields can use `.type`, which resolves relative to the current field's parent path.

## Execution Timing

`x-reaction` runs at two moments in the current implementation:

1. once immediately after `form.setSchema()` finishes installing the field tree
2. again whenever any dependency value changes

If `dependencies` is omitted, the reaction watches the current field itself.

## Runtime Context

Inside expressions and `computed` handlers, you can use:

- `$self`
- `$form`
- `$values`
- `$deps`
- `$dependencies`
- `$value`
- custom variables injected via `createForm({ scope })`

## Typical Patterns

### 1. Visibility linkage

This example matches the real schema style used by the demo. When `contactType` changes, the `display` of `email` is updated automatically:

```json
{
  "type": "object",
  "properties": {
    "contactType": {
      "type": "string",
      "title": "Contact Method",
      "component": "Select"
    },
    "email": {
      "type": "string",
      "title": "Email Address",
      "component": "Input",
      "x-reaction": {
        "display": {
          "type": "match",
          "dependencies": {
            "contactType": "contactType"
          },
          "match": {
            "email": "visible",
            "default": "none"
          }
        }
      }
    }
  }
}
```

### 2. Computed field value

```json
{
  "x-reaction": {
    "value": {
      "type": "expression",
      "dependencies": {
        "quantity": "quantity",
        "unitPrice": "unitPrice"
      },
      "expression": "Number($deps.quantity || 0) * Number($deps.unitPrice || 0)"
    }
  }
}
```

This is a good fit for readonly calculated fields such as totals, discounts, or display-only labels.

### 3. Async dataSource loading

```json
{
  "x-reaction": {
    "dataSource": {
      "type": "computed",
      "dependencies": {
        "category": "category"
      },
      "handler": "fetchSubCategories"
    }
  }
}
```

The handler must be registered in `createForm({ handlers })`:

```ts
const form = createForm({
  handlers: {
    fetchSubCategories: async ({ deps }) => {
      if (!deps.category) return []
      const response = await fetch(`/api/sub-categories?category=${deps.category}`)
      const data = await response.json()
      return data.map((item) => ({ label: item.name, value: item.code }))
    },
  },
})
```

## Async Behavior

Only `computed` rules truly support async behavior.

When a handler returns a Promise:

- the field enters loading state
- for the same field and reaction key, only the latest async result is kept
- older requests cannot overwrite newer state even if they finish later

That is why async linkage in this project avoids stale request write-back.

## Assignment Boundaries

Different target keys are applied differently:

- `props` and `decoratorProps` are shallow-merged rather than replaced
- `component` and `decorator` support both strings and `[name, props]`
- `dataSource` is normalized before assignment
- fields with `display: 'none'` do not appear in `form.values` and are skipped by validation
- fields with `display: 'hidden'` still keep their value and still participate in validation

## When To Use x-reaction

Good fits:

- field visibility switching
- dynamic title, description, and placeholder updates
- readonly or disabled mode switching
- calculated field values
- async option loading
- switching component or decorator by current form state

Bad fits:

- global notifications, analytics, or logging
- side effects that are not field-state derivation
- business workflows that should live outside the field model

Those concerns belong in `effects` or the surrounding application layer rather than being forced into reactions.
