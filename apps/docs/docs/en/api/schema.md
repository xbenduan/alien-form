# Schema API

AlienForm schema is based on JSON Schema, but the current implementation only supports the subset that the repository actually consumes. Think of schema here as the config object that drives `Form.createField()` and the React rendering layer, not as a full JSON Schema interpreter.

## Root Schema

The root node type is `IFormSchema`:

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

- `type` must currently be `'object'`.
- `properties` is the entry point of the field tree.
- `definitions` is only used for local `#/definitions/...` references.

## Field Schema

`IFieldSchema` combines a JSON Schema subset with AlienForm protocol extensions.

### Supported Standard Fields

| Field | Meaning |
| --- | --- |
| `type` | Supports `string`, `number`, `boolean`, `object`, `array`, `void`, `date`, `datetime` |
| `title` / `description` | Field label and description |
| `default` | Default value |
| `required` | `true` or inherited from parent `required: string[]` |
| `enum` | Normalized into `dataSource` |
| `const` | Static validator input |
| `minimum` / `maximum` / `exclusiveMinimum` / `exclusiveMaximum` / `multipleOf` | Number validators |
| `minLength` / `maxLength` / `pattern` / `format` | String validators |
| `minItems` / `maxItems` / `uniqueItems` | Array validators |
| `properties` / `items` | Object and array structure |
| `definitions` / `$ref` | Local definitions and references |
| `readOnly` | Participates in pattern derivation |

### AlienForm Extension Fields

| Field | Current behavior |
| --- | --- |
| `order` | Controls sibling sorting |
| `state` | Initial `display`, `pattern`, `visible`, `hidden`, `readOnly`, `readPretty`, `disabled` |
| `validators` | Static validators: function, rule object, or array |
| `component` | Render component name |
| `props` | Component props, stored in `field.componentProps` |
| `decorator` | Decorator component name |
| `decoratorProps` | Decorator props |
| `dataSource` | Option list |
| `dataSourcePolicy` | Value retention strategy after options change: `preserve`, `clear`, `filter`, `first` |
| `content` | Non-input content node, rendered directly when present |
| `data` | Field-local meta data |
| `layoutProps` | Extra layout props for void containers |
| `x-reaction` | Field property reactions |
| `x-format` | Input/output formatting |
| `x-validate` | Dynamic validation |

## x-reaction

The key of `x-reaction` is the field property you want to mutate; the value is one rule or an array of rules.

### Supported Reaction Keys

The current source supports these keys:

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

Anything outside this list is reported through `onError` as `unsupported reaction key`.

### Four Rule Types

| `type` | Use case |
| --- | --- |
| `static` | Fixed value |
| `expression` | Safe expression evaluation |
| `match` | Branch mapping |
| `computed` | Business handler, sync or async |

### Two Dependency Shapes

```json
{
  "dependencies": ["country", "city"]
}
```

- Access through `$deps[0]` and `$deps[1]`.

```json
{
  "dependencies": {
    "category": "category",
    "type": "contactType"
  }
}
```

- Access through `$deps.category` and `$deps.type`.
- The full named map is also exposed as `$dependencies`.

### Demo: Visibility and Async Options

The snippet below is adapted from `apps/demo/src/schema/03-x-reaction-detail.json`:

```json
{
  "contactType": {
    "type": "string",
    "title": "Contact Type",
    "component": "Select",
    "decorator": "FormItem",
    "dataSource": [
      { "label": "Email", "value": "email" },
      { "label": "Phone", "value": "phone" },
      { "label": "Lark", "value": "lark" }
    ]
  },
  "email": {
    "type": "string",
    "title": "Email",
    "component": "Input",
    "decorator": "FormItem",
    "x-reaction": {
      "display": {
        "type": "match",
        "dependencies": { "contactType": "contactType" },
        "match": {
          "email": "visible",
          "default": "none"
        }
      }
    }
  },
  "subCategory": {
    "type": "string",
    "title": "Sub Category",
    "component": "Select",
    "decorator": "FormItem",
    "dataSourcePolicy": "clear",
    "x-reaction": {
      "dataSource": {
        "type": "computed",
        "dependencies": { "category": "category" },
        "handler": "fetchSubCategories"
      },
      "disabled": {
        "type": "expression",
        "dependencies": { "category": "category" },
        "expression": "!$deps.category"
      }
    }
  }
}
```

## x-format

`x-format` transforms values before they enter a field and before they leave through `form.values`:

```ts
interface SchemaFormat {
  input?: SchemaRuleSet
  output?: SchemaRuleSet
}
```

- `input` runs before values from `default`, `initialValues`, and `setValues()` are stored.
- `output` runs when `form.values` is read.
- The current implementation is synchronous, so `computed` handlers inside `x-format` must return synchronously.

### Demo: Amount Conversion and Code Normalization

This snippet comes from `apps/demo/src/schema/04-x-format.json`:

```json
{
  "amount": {
    "type": "number",
    "title": "Amount",
    "default": 12345,
    "component": "Input",
    "decorator": "FormItem",
    "x-format": {
      "input": {
        "type": "expression",
        "expression": "$value / 100"
      },
      "output": {
        "type": "expression",
        "expression": "Number($value) * 100"
      }
    }
  },
  "code": {
    "type": "string",
    "title": "Code",
    "x-format": {
      "input": { "type": "computed", "handler": "normalizeCode" },
      "output": { "type": "computed", "handler": "normalizeCode" }
    }
  }
}
```

## x-validate

`x-validate` runs after static validators. The source normalizes its output into `FieldError[]` and supports these return shapes:

| Return value | Result |
| --- | --- |
| `undefined` / `null` / `true` | pass |
| `false` | fail with `Invalid value` |
| `string` | fail with that string as the message |
| `object` | can be `{ message, type }` or a validator-rule object |
| `array` | every item is normalized recursively |

### Demo: Expression Validation and Async Validation

The snippet below comes from `apps/demo/src/schema/05-x-validate.json`:

```json
{
  "username": {
    "type": "string",
    "title": "Username",
    "component": "Input",
    "decorator": "FormItem",
    "x-validate": {
      "type": "expression",
      "expression": "$value === 'admin' ? undefined : 'Username must be admin'"
    }
  },
  "confirmPassword": {
    "type": "string",
    "title": "Confirm Password",
    "component": "Input",
    "decorator": "FormItem",
    "x-validate": {
      "type": "expression",
      "dependencies": { "password": "password" },
      "expression": "$value === $deps.password ? undefined : 'Passwords do not match'"
    }
  },
  "confirmCode": {
    "type": "string",
    "title": "Async Confirm Code",
    "component": "Input",
    "decorator": "FormItem",
    "x-validate": {
      "type": "computed",
      "handler": "checkConfirmCode"
    }
  }
}
```

## Arrays and Layout Nodes

### Array Fields

Array-field mode only activates when `items` is an object with `properties`. That is when `push`, `remove`, `moveUp`, and `moveDown` become meaningful.

### Void Layout Nodes

`type: 'void'` means the node itself does not appear in `form.values`, but the React layer still renders it as a layout container when `component` is provided.

## Important Implementation Notes

- `enum` and `dataSource` both end up in `field.dataSource`, and `{ key, title }` is normalized into `{ label, value }`.
- `readOnly: true` participates in pattern derivation and can result in `readOnly` mode.
- `$ref` only supports local `#/definitions/Name` references today.
