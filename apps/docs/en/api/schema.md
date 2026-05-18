# Schema API

FormBao Schema is based on JSON Schema and adds UI, state, and reactive properties for enterprise forms.

## Field properties

| Field | Description |
| --- | --- |
| `component` | Component name |
| `props` | Component props |
| `decorator` | Decorator name |
| `decoratorProps` | Decorator props |
| `dataSource` | Static options |
| `validators` | Validation rules |
| `state` | Initial state such as `visible`, `display`, and `pattern` |
| `reactions` | Field-owned property-level derivation rules |
| `order` | Field order |

## Reactions

The key of `reactions` is the field property to write. The value is a rule or an array of rules.

```ts
type SchemaReactionType = 'static' | 'expression' | 'match' | 'computed'
```

```json
{
  "reactions": {
    "title": { "type": "static", "value": "企业名称" },
    "display": {
      "dependencies": { "type": "type" },
      "type": "expression",
      "expression": "$deps.type === 'company' ? 'visible' : 'none'"
    },
    "props": {
      "dependencies": { "type": "type" },
      "type": "match",
      "source": "$deps.type",
      "match": {
        "company": { "placeholder": "请输入企业名称" },
        "default": { "placeholder": "请输入姓名" }
      }
    },
    "dataSource": {
      "dependencies": { "country": "country" },
      "type": "computed",
      "handler": "fetchCities"
    }
  }
}
```

## Derivable properties

Common keys include: `value`、`display`、`visible`、`hidden`、`pattern`、`disabled`、`readOnly`、`readPretty`、`editable`、`required`、`title`、`description`、`props`、`decoratorProps`、`component`、`decorator`、`dataSource`。
