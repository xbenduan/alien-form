# Schema Protocol

AlienForm\'s Schema is a DSL that core compiles into a field tree and runtime rules. It combines three aspects:

- **Static structure**: field paths, nesting, array items
- **Runtime projection**: component, decorator, display/disabled, data source
- **Dynamic rules**: `x-reaction`, `x-format`, `x-validate`

> AlienForm Schema is NOT JSON Schema. It serves AlienForm\'s runtime exclusively and does not pursue compatibility with any external standard.

## Root Node

```ts
interface IFormSchema {
  type: "object";
  properties?: Record<string, IFieldSchema>;
  definitions?: Record<string, IFieldSchema>;
}
```

Entry: `form.setSchema(schema)` or `<SchemaField schema={schema} />`.

Process: clear old fields → cache `definitions` → sort by `order` → recursively create field tree → install `x-reaction`.

---

## Field Properties

### Structural Fields

| Field | Type | Description | Runtime Mapping |
| --- | --- | --- | --- |
| `type` | `SchemaTypes` | Field type: `string` \| `number` \| `boolean` \| `object` \| `array` \| `void` | Determines node behavior |
| `title` | `string` | Field title | → `field.title` |
| `description` | `string` | Field description | → `field.description` |
| `default` | `any` | Default value (lower priority than `initialValues`) | → `field.initialValue` |
| `properties` | `Record<string, IFieldSchema>` | Object sub-properties | → recursive child fields |
| `items` | `IFieldSchema` | Array item schema | → array row template |
| `$ref` | `string` | Reference to root-level `definitions` | → merged into current node |

### AlienForm Protocol Fields

| Field | Type | Description | Runtime Mapping |
| --- | --- | --- | --- |
| `order` | `number` | Render order weight (smaller = first) | → field creation order |
| `required` | `boolean \| string[]` | Required flag | → `field.required` |
| `component` | `string` | Component registry key | → `field.component` |
| `props` | `Record<string, any>` | Component props | → `field.componentProps` |
| `decorator` | `string` | Decorator registry key | → `field.decorator` |
| `decoratorProps` | `Record<string, any>` | Decorator props | → `field.decoratorProps` |
| `display` | `FieldDisplayTypes` | Display mode: `visible` \| `hidden` \| `none` | Default `visible` |
| `disabled` | `boolean` | Whether field is disabled | Default `false` |
| `validate` | `SchemaValidate` | Built-in static constraints (see below) | → validation pipeline step 1 |
| `dataSource` | `Array<{label, value, ...}>` | Static options | → `field.dataSource` |
| `dataSourcePolicy` | `"preserve" \| "clear" \| "filter" \| "first"` | Value reconciliation on dataSource change | → value reconciliation |
| `x-reaction` | `SchemaReactions` | Dynamic property derivation rules | → reactive effects |
| `x-format` | `{input?, output?}` | Value input/output transforms | → on create + form.values read |
| `x-validate` | `SchemaRuleSet` | Dynamic validation rules | → validation pipeline step 2 |

---

## `validate` — Built-in Static Constraints

`validate` is the declarative entry point for preset constraints:

```ts
{
  type: "string",
  validate: {
    required: true,
    minLength: 1,
    maxLength: 20,
    pattern: "^[a-z]+$"
  }
}
```

### Fields

| Field | Type | Description |
| --- | --- | --- |
| `required` | `boolean` | Required (empty value check) |
| `minimum` | `number` | Minimum value (`>=`) |
| `maximum` | `number` | Maximum value (`<=`) |
| `exclusiveMinimum` | `number` | Exclusive minimum (`>`) |
| `exclusiveMaximum` | `number` | Exclusive maximum (`<`) |
| `multipleOf` | `number` | Must be a multiple of |
| `minLength` | `number` | Minimum string length |
| `maxLength` | `number` | Maximum string length |
| `pattern` | `string` | Regex pattern |
| `format` | `ValidatorFormats` | Preset format: `email` \| `url` \| `phone` \| etc. |
| `minItems` | `number` | Minimum array items |
| `maxItems` | `number` | Maximum array items |
| `uniqueItems` | `boolean` | Array items must be unique |
| `const` | `any` | Value must strictly equal this constant |
| `message` | `string` | Custom error message (overrides all defaults) |

### `validate` vs `x-validate`

| Dimension | `validate` | `x-validate` |
| --- | --- | --- |
| Role | Built-in preset constraints | Custom dynamic validation |
| Syntax | Plain object declaration | SchemaXRule model |
| Capability | Finite closed set | Unlimited (expression / match / computed) |
| Dependencies | None | Can declare `dependencies` |
| Async | No | Yes (computed handler) |
| Execution | Pipeline step 1 | Pipeline step 2 |

---

## Validation Pipeline

Validation has exactly two layers with clear responsibilities:

1. **`validate`** — built-in static constraints (declarative object, synchronous)
2. **`x-validate`** — dynamic rules (SchemaXRule model, supports dependencies/async/expressions)

Executed in order; errors from any step append to `field.errors`.

---

## Node Type Semantics

### `object`

| Mode | Condition | Behavior |
| --- | --- | --- |
| Container field | has `component` | Creates field instance + recursive children |
| Transparent group | no `component` | Path prefix only, no field created |

### `void`

Grouping/wrapper node. **Path-transparent** — children inherit the parent path prefix; the `void` node's key does not appear in child paths or `form.values`.

Can carry `component`, `props`, `title`, `content`, and recursively renders children. Typical use: card grouping, grid layout, step containers.

```json
{
  "card": {
    "type": "void",
    "component": "Card",
    "properties": {
      "name": { "type": "string" },
      "age": { "type": "number" }
    }
  }
}
// → child paths: "name", "age" (not "card.name")
// → form.values: { name: "...", age: ... }
```

### `array`

| Mode | Condition | Behavior |
| --- | --- | --- |
| Complex array | `items` has `properties` | Array field + per-row child field trees |
| Simple array | `items` without `properties` | Array field only, no row expansion |

Row field path format: `arrayPath.{index}.childKey`.

---

## Rule Model (SchemaXRule)

`x-reaction`, `x-format`, `x-validate` share the same rule types:

| Type | Structure | Description |
| --- | --- | --- |
| `static` | `{ type: "static", value: any }` | Fixed value |
| `expression` | `{ type: "expression", expression: string }` | Restricted expression eval |
| `match` | `{ type: "match", source?, match: Record<string, any> }` | Branch mapping |
| `computed` | `{ type: "computed", handler: string, params? }` | Call registered handler |

Each rule may include `dependencies` (`string[]` or `Record<string, string>`).

### Expression Context

| Variable | Meaning |
| --- | --- |
| `$self` | Current field instance |
| `$form` | Form instance |
| `$values` | Values snapshot |
| `$deps` | Dependency values |
| `$dependencies` | Dependency values object |
| `$value` | Current field value |
| *scope vars* | From `createForm({ scope })` |

---

## `$ref` and `definitions`

Only `"$ref": "#/definitions/Name"` is supported. `definitions` can only be declared on root `IFormSchema`.

Merge rule: local properties override referenced target properties.

---

## `form.values` Output Rules

`form.values` is filtered before output:

1. Exclude fields with `display === "none"`
2. Exclude `void` nodes
3. Exclude array sub-paths (array fields aggregate row values)
4. Apply `x-format.output` to each output value

> `display: "hidden"` fields still participate in `form.values` and validation.
