# Schema 协议

FormBao 提供基于 Formily 思想的 **企业级 Schema 协议** — 在 JSON Schema 基础上使用 `component`、`props`、`state`、`reactions` 等自然字段描述 UI 渲染、字段联动和验证。

## 根 Schema (`IFormSchema`)

```ts
interface IFormSchema {
  type: 'object'
  title?: string
  properties?: Record<string, IFieldSchema>
  definitions?: Record<string, IFieldSchema>
}
```

## 类型系统

| 类型 | 说明 |
|------|------|
| `string` | 文本字段 |
| `number` | 数值字段 |
| `boolean` | 开关/复选框 |
| `object` | 嵌套容器 |
| `array` | 可重复字段 |
| `void` | 纯布局节点，不产生值 |
| `date` / `datetime` | 日期字段 |

## FormBao 协议字段

### 组件与装饰器

| 属性 | 说明 |
|------|------|
| `component` | 组件名（如 `"Input"`） |
| `props` | 传给组件的属性 |
| `decorator` | 包装组件（如 `"FormItem"`） |
| `decoratorProps` | 传给装饰器的属性 |
| `content` | 静态内容，跳过组件渲染 |

### 显示与模式

| 属性 | 说明 |
|------|------|
| `state.display` | `'visible'` / `'hidden'` / `'none'` |
| `state.pattern` | `'editable'` / `'readOnly'` / `'disabled'` / `'readPretty'` |
| `state.visible` | `false` → `display: 'none'` |
| `state.hidden` | `true` → `display: 'hidden'` |
| `state.disabled` | `true` → `pattern: 'disabled'` |
| `state.readOnly` | `true` → `pattern: 'readOnly'` |
| `state.readPretty` | `true` → `pattern: 'readPretty'` |

::: info Display vs Pattern
`state.display` 控制字段**是否**渲染。`state.pattern` 控制已渲染字段的**交互方式**。`display: 'none'` 的字段从 `form.values` 和验证中排除。
:::

### 数据与排序

| 属性 | 说明 |
|------|------|
| `order` | 渲染顺序（越小越靠前） |
| `data` | 任意元数据 |
| `dataSource` | 静态选项 |
| `asyncDataSource` | 远程选项 |
| `validators` | 验证规则 |
| `reactions` | 字段联动 |

## `$ref` 和 `definitions`

```json
{
  "definitions": {
    "address": {
      "type": "object",
      "properties": {
        "street": { "type": "string", "component": "Input" },
        "city": { "type": "string", "component": "Input" }
      }
    }
  },
  "properties": {
    "home": { "$ref": "#/definitions/address", "title": "家庭地址" },
    "work": { "$ref": "#/definitions/address", "title": "工作地址" }
  }
}
```

本地属性覆盖 `$ref` 属性。

## 验证器

### 内置格式

| 格式 | 说明 |
|------|------|
| `email` | 邮箱 |
| `url` | URL |
| `phone` | 电话号码 |
| `number` | 数字字符串 |
| `integer` | 整数字符串 |
| `idcard` | 身份证号 |
| `ip` | IPv4 |
| `ipv6` | IPv6 |
| `zip` | 邮编 |

### SchemaEnum

`enum` 属性接受混合格式，统一规范化为 `{ label, value }`：

```ts
type SchemaEnum = Array<
  | string                       // → { label: "foo", value: "foo" }
  | number                       // → { label: "42", value: 42 }
  | { label: any; value: any }   // 原样使用
  | { key: any; title: any }     // → { label: title, value: key }
>
```
