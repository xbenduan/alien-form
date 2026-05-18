# 字段联动

FormBao 实现了完整的 Formily `reactions` 协议。Reactions 在 `setSchema()` 期间由 `Form._setupFieldReactions()` 设置，使用 Alien Signals 的 `effect()` 实现响应式。

## 主动模式

声明 `reactions` 的字段控制**目标**字段：

```json
{
  "isVip": {
    "type": "boolean",
    "component": "Switch",
    "reactions": {
      "target": "vipCode",
      "fulfill": {
        "state": { "display": "visible", "required": true }
      },
      "otherwise": {
        "state": { "display": "none", "required": false }
      }
    }
  }
}
```

## 被动模式

带 `reactions` 的字段**响应其依赖**：

```json
{
  "city": {
    "reactions": {
      "dependencies": { "country": "country" },
      "when": "{{$deps.country === 'cn'}}",
      "fulfill": {
        "schema": { "props": { "placeholder": "选择中国城市" } }
      }
    }
  }
}
```

## 表达式字符串

```json
{ "reactions": "{{$self.value = $values.firstName + ' ' + $values.lastName}}" }
```

## 表达式作用域

| 变量 | 值 |
|------|---|
| `$self` | 声明 reaction 的字段 |
| `$form` | 表单实例 |
| `$values` | `form.values` |
| `$deps` | 解析后的依赖值 |
| `$dependencies` | 始终为对象形式 |
| `$target` | 目标字段（主动）或自身（被动） |
| 自定义 scope | 来自 `FormConfig.scope` |

## 分支操作

### `state` — 设置字段状态

```json
{ "state": { "display": "visible", "required": true, "value": "{{$deps[0] * 2}}" } }
```

### `schema` — 更新 Schema 属性

```json
{ "schema": { "title": "新标题", "props": { "placeholder": "..." }, "enum": ["a", "b"] } }
```

### `run` — 执行 JavaScript

```json
{ "run": "$target.setDataSource([{label:'A',value:'a'}])" }
```

## 相对路径

在数组项中用 `.` 前缀引用兄弟字段：

```json
{ "target": ".shipping" }
```

## 多重联动

```json
{
  "reactions": [
    { "target": "fieldA", "fulfill": { "state": { "visible": true } } },
    { "target": "fieldB", "fulfill": { "state": { "disabled": true } } }
  ]
}
```
