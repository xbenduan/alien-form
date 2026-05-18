# Enterprise Security

FormBao security boundary: Schema may describe structure, validation, and controlled derivation, but it must not carry arbitrary execution capability.

## Reaction security model

```json
{
  "reactions": {
    "visible": {
      "dependencies": { "type": "type" },
      "type": "expression",
      "expression": "$deps.type === 'company'"
    },
    "dataSource": {
      "dependencies": { "country": "country" },
      "type": "computed",
      "handler": "fetchCities"
    }
  }
}
```

- `expression` uses safe expression evaluation only.
- `computed` can only call handlers explicitly registered by the host application.
- Remote requests, auth, cache, and fallbacks are managed by application handlers.
- Schema provides no arbitrary script execution entry.

## Recommended practices

| Scenario | Recommended protocol |
| --- | --- |
| Fixed property | `type: "static"` |
| Conditional display | `type: "expression"` 写入 `visible` 或 `display` |
| Enum mapping | `type: "match"` 写入 `props`、`component` 等属性 |
| Async options | `type: "computed"` 写入 `dataSource` |

## Do not

- Describe URL requests in schema.
- Write function bodies or statement scripts in schema.
- Control another field directly from one field.
- Put auth tokens or internal endpoints into schema.
