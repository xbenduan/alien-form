# Linkage Protocol

AlienForm `x-reaction` are **field-owned, property-level** derivation rules. A field declares how one of its own properties is computed from dependencies; it does not control another field.

## Basic structure

```json
{
  "type": "string",
  "title": "邮箱",
  "x-reaction": {
    "visible": {
      "dependencies": { "contactType": "contactType" },
      "type": "expression",
      "expression": "$deps.contactType === 'email'"
    },
    "required": {
      "dependencies": { "contactType": "contactType" },
      "type": "expression",
      "expression": "$deps.contactType === 'email'"
    }
  }
}
```

## Built-in types

AlienForm has exactly four built-in reaction rule types:

- `static`：write a fixed value.
- `expression`：evaluate a safe raw expression string.
- `match`：map dependency values to outputs.
- `computed`：call application-registered `handlers` for async data or complex computation.

## Property-level derivation

```json
{
  "x-reaction": {
    "display": {
      "dependencies": { "enabled": "enabled" },
      "type": "expression",
      "expression": "$deps.enabled ? 'visible' : 'none'"
    },
    "props": {
      "dependencies": { "mode": "mode" },
      "type": "match",
      "source": "$deps.mode",
      "match": {
        "readonly": { "placeholder": "只读模式" },
        "default": { "placeholder": "可编辑模式" }
      }
    }
  }
}
```

## Async data

Core does not fetch URLs. Register application-level handlers for remote options:

```ts
const form = createForm({
  handlers: {
    fetchCities: async ({ deps }) => api.getCities(deps.country),
  },
})
```

```json
{
  "x-reaction": {
    "dataSource": {
      "dependencies": { "country": "country" },
      "type": "computed",
      "handler": "fetchCities"
    }
  }
}
```

## Constraints

- No cross-field control.
- No branch/action protocol.
- No arbitrary script execution in schema.
- No URL fetch in core.
- All dynamic behavior is expressed as field-owned property derivation.
