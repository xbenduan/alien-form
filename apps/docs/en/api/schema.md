# Schema Specification

FormBao provides an **enterprise Schema Protocol** inspired by Formily — a JSON Schema superset using natural fields such as `component`, `props`, `state`, and `reactions` for UI rendering, field linkage, and validation.

## Root Schema (`IFormSchema`)

```ts
interface IFormSchema {
  type: 'object'
  title?: string
  description?: string
  required?: boolean | string[]
  properties?: Record<string, IFieldSchema>
  definitions?: Record<string, IFieldSchema>
}
```

## Field Schema (`IFieldSchema`)

### Type System

| Type | Description |
|------|-------------|
| `string` | Text fields |
| `number` | Numeric fields |
| `boolean` | Toggle/checkbox |
| `object` | Nested container |
| `array` | Repeatable fields (uses `items`) |
| `void` | Layout-only node — produces no value |
| `date` / `datetime` | Date fields |

### Standard JSON Schema Properties

```ts
interface IFieldSchema {
  type?: SchemaTypes
  title?: string
  description?: string
  default?: any
  required?: boolean | string[]
  enum?: SchemaEnum  // auto-mapped to dataSource
  const?: any

  // Numeric
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  multipleOf?: number

  // String
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: ValidatorFormats

  // Array
  maxItems?: number
  minItems?: number
  uniqueItems?: boolean

  // Structural
  properties?: Record<string, IFieldSchema>
  items?: IFieldSchema | IFieldSchema[]
  definitions?: Record<string, IFieldSchema>
  $ref?: string
}
```

### FormBao Protocol Fields

#### Component & Decorator

| Property | Type | Description |
|----------|------|-------------|
| `component` | `string` | Component name (e.g. `"Input"`, `"Select"`) |
| `props` | `Record` | Props passed to the component |
| `decorator` | `string` | Wrapper component (e.g. `"FormItem"`) |
| `decoratorProps` | `Record` | Props passed to the decorator |
| `content` | `any` | Static content — bypasses component rendering |

#### Display & Pattern

| Property | Type | Description |
|----------|------|-------------|
| `state.display` | `'visible' \| 'hidden' \| 'none'` | Visibility control |
| `state.pattern` | `'editable' \| 'readOnly' \| 'disabled' \| 'readPretty'` | Interaction mode |
| `state.visible` | `boolean` | Shortcut: `false` → `state.display: 'none'` |
| `state.hidden` | `boolean` | Shortcut: `true` → `state.display: 'hidden'` |
| `state.disabled` | `boolean` | Shortcut: `true` → `state.pattern: 'disabled'` |
| `state.editable` | `boolean` | Shortcut: `false` → `state.pattern: 'readOnly'` |
| `state.readOnly` | `boolean` | → `state.pattern: 'readOnly'` |
| `state.readPretty` | `boolean` | → `state.pattern: 'readPretty'` |

::: info Display vs Pattern
`state.display` controls **whether** a field is rendered. `state.pattern` controls **how** a rendered field behaves. A field with `display: 'none'` is excluded from `form.values` and `form.validate()`.
:::

#### Data & Ordering

| Property | Type | Description |
|----------|------|-------------|
| `order` | `number` | Controls render order (lower = earlier) |
| `data` | `Record` | Arbitrary metadata |
| `dataSource` | `Array<{label, value}>` | Static options |
| `asyncDataSource` | `AsyncDataSource` | Remote options |
| `validators` | `Validator \| Validator[]` | Validation rules |
| `reactions` | `SchemaReactions` | Field linkage |

## `$ref` and `definitions`

Reuse schema fragments:

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
    "home": { "$ref": "#/definitions/address", "title": "Home Address" },
    "work": { "$ref": "#/definitions/address", "title": "Work Address" }
  }
}
```

Local properties override `$ref` properties. Resolution is handled by `Form._resolveRef()`.

## Validators

### Rule-based

```json
{ "required": true, "message": "Required" }
{ "format": "email" }
{ "min": 1, "max": 100 }
{ "minLength": 2, "maxLength": 50 }
{ "pattern": "^[A-Z]", "message": "Must start with uppercase" }
{ "exclusiveMinimum": 0 }
{ "multipleOf": 5 }
{ "const": "expected" }
{ "minItems": 1, "maxItems": 10 }
{ "uniqueItems": true }
```

### Built-in Formats

The `format` field triggers `validateFormat()` in `field.ts`:

| Format | Regex |
|--------|-------|
| `email` | `^[^\s@]+@[^\s@]+\.[^\s@]+$` |
| `url` | `^https?://.+` |
| `phone` | `^[\d\s\-+()]+$` |
| `number` | `isNaN(Number(str))` |
| `integer` | `^-?\d+$` |
| `idcard` | `^(\d{15}\|\d{17}[\dXx])$` |
| `ip` | `^(\d{1,3}\.){3}\d{1,3}$` |
| `ipv6` | IPv6 pattern |
| `zip` | `^\d{5,6}$` |

### Custom Validator Function

```ts
'validators': [
  async (value, field) => {
    if (await isUsernameTaken(value)) return 'Username already taken'
  }
]
```

## SchemaEnum

The `enum` property accepts mixed formats, all normalized to `{ label, value }`:

```ts
type SchemaEnum = Array<
  | string                              // → { label: "foo", value: "foo" }
  | number                              // → { label: "42", value: 42 }
  | { label: any; value: any }          // used as-is
  | { key: any; title: any }            // → { label: title, value: key }
>
```
