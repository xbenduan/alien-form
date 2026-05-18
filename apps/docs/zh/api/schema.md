# Schema API

FormBao Schema 基于 JSON Schema，并扩展了企业表单所需的 UI、状态和响应式属性。

## 字段常用属性

| 字段 | 说明 |
| --- | --- |
| `component` | 渲染组件名 |
| `props` | 组件属性 |
| `decorator` | 装饰器组件名 |
| `decoratorProps` | 装饰器属性 |
| `dataSource` | 静态选项数据 |
| `validators` | 校验规则 |
| `state` | 初始状态，如 `visible`、`display`、`pattern` |
| `reactions` | 字段自有属性级派生规则 |
| `order` | 字段排序 |

## Reactions

`reactions` 的 key 是要写入的字段属性，value 是 rule 或 rule 数组。

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

## 可派生属性

常用 key 包括：`value`、`display`、`visible`、`hidden`、`pattern`、`disabled`、`readOnly`、`readPretty`、`editable`、`required`、`title`、`description`、`props`、`decoratorProps`、`component`、`decorator`、`dataSource`。
