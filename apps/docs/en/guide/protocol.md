# Protocol Design

FormBao is inspired by Schema Form ideas but does not aim for Formily compatibility. The enterprise protocol prioritizes auditability, governance, and a simpler mental model.

## Principles

- Remove `x-*` names and use natural fields.
- Centralize dynamic behavior into field-owned `reactions`.
- `reactions` only derive the current field properties and do not control other fields.
- Built-in rule types are exactly `static`, `expression`, `match`, and `computed`.
- Core does not fetch URLs or own auth, network, and cache policies.

## Example

```json
{
  "component": "Select",
  "props": { "placeholder": "请选择" },
  "reactions": {
    "dataSource": {
      "dependencies": { "country": "country" },
      "type": "computed",
      "handler": "fetchCities"
    }
  }
}
```

## Why no two-layer protocol

A two-layer protocol mixes conditions, branches, actions, and controlled fields, making audits harder. FormBao keeps the main protocol single-layered: `reactions[key] = rule`, where the key is the derived field property.
