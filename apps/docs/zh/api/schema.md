# Schema 协议

FormBao 完整实现 **Formily Schema 协议** — 在 JSON Schema 基础上通过 `x-*` 属性扩展 UI 渲染、字段联动和验证。

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

## `x-*` 扩展

### 组件与装饰器

| 属性 | 说明 |
|------|------|
| `x-component` | 组件名（如 `"Input"`） |
| `x-component-props` | 传给组件的属性 |
| `x-decorator` | 包装组件（如 `"FormItem"`） |
| `x-decorator-props` | 传给装饰器的属性 |
| `x-content` | 静态内容，跳过组件渲染 |

### 显示与模式

| 属性 | 说明 |
|------|------|
| `x-display` | `'visible'` / `'hidden'` / `'none'` |
| `x-pattern` | `'editable'` / `'readOnly'` / `'disabled'` / `'readPretty'` |
| `x-visible` | `false` → `display: 'none'` |
| `x-hidden` | `true` → `display: 'hidden'` |
| `x-disabled` | `true` → `pattern: 'disabled'` |
| `x-read-only` | `true` → `pattern: 'readOnly'` |
| `x-read-pretty` | `true` → `pattern: 'readPretty'` |

::: info Display vs Pattern
`x-display` 控制字段**是否**渲染。`x-pattern` 控制已渲染字段的**交互方式**。`display: 'none'` 的字段从 `form.values` 和验证中排除。
:::

### 数据与排序

| 属性 | 说明 |
|------|------|
| `x-index` | 渲染顺序（越小越靠前） |
| `x-data` | 任意元数据 |
| `x-data-source` | 静态选项 |
| `x-async-data-source` | 远程选项 |
| `x-validator` | 验证规则 |
| `x-reactions` | 字段联动 |

## `$ref` 和 `definitions`

```json
{
  "definitions": {
    "address": {
      "type": "object",
      "properties": {
        "street": { "type": "string", "x-component": "Input" },
        "city": { "type": "string", "x-component": "Input" }
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
