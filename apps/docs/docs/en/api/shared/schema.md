# Schema

## Description

The schema protocol is the shared language between `@alien-form/core` and `@alien-form/react`. AlienForm does not currently expose a `Schema` class. The runtime consumes plain JSON objects directly.

There are two real entry points:

- `form.setSchema(schema)`
- `<SchemaField schema={schema} />`

## Root Shape

```ts
interface IFormSchema {
  type: 'object'
  properties?: Record<string, IFieldSchema>
  definitions?: Record<string, IFieldSchema>
}
```

## IFieldSchema Composition

`IFieldSchema` can be understood as three layers combined together:

- JSON Schema subset: `type`, `default`, `required`, `minimum`, and so on
- UI projection fields: `component`, `props`, `decorator`, `decoratorProps`
- dynamic protocol fields: `x-reaction`, `x-format`, `x-validate`

## Primitive Types

Supported field types:

- `string`
- `number`
- `boolean`
- `object`
- `array`
- `void`
- `date`
- `datetime`

## Standard Fields

| Field | Description |
| --- | --- |
| `type` | field type |
| `title` | field title |
| `description` | field description |
| `default` | default value |
| `required` | whether required |
| `minimum` / `maximum` | numeric range |
| `minLength` / `maxLength` | string length range |
| `pattern` | regex rule |
| `format` | format rule |
| `properties` | object child fields |
| `items` | array item definition |
| `definitions` | root reusable definitions, allowed only on the root `IFormSchema` |
| `$ref` | local definitions reference |

## Runtime Extension Fields

| Field | Description |
| --- | --- |
| `state` | initial display and interaction state |
| `validators` | static validation rules |
| `component` | component registry key |
| `props` | component props |
| `decorator` | decorator registry key |
| `decoratorProps` | decorator props |
| `dataSource` | option list |
| `dataSourcePolicy` | value handling policy when the option list changes |
| `x-reaction` | field-property linkage |
| `x-format` | input/output value conversion |
| `x-validate` | dynamic validation rules |
| `content` | layout node content |
| `data` | custom metadata |

## Node Behavior

### object

- with `component`: creates a field instance and still recurses into child properties
- without `component`: acts only as a structural container and does not create a standalone field

### void

- acts as a layout node
- does not participate in `form.values`
- can still carry component, title, description, and layout props

### array

- when `items` is an object structure, the runtime creates the array field plus row child fields
- otherwise it behaves as a simple array field

## definitions / $ref

### Supported Scope

The current implementation only supports:

```json
{ "$ref": "#/definitions/Name" }
```

And `definitions` can only be declared on the root `IFormSchema`, not on arbitrary field nodes.

Not supported:

- remote references
- arbitrary JSON Pointer
- non-root definitions paths

### Merge Rule

After `$ref` expansion, local fields override referenced fields.

## state

`state` keeps only two canonical entries:

- `display`: `visible | hidden | none`
- `pattern`: `editable | readOnly | disabled | readPretty`

## dataSource

`dataSource` is normalized into a consistent option structure and is the only option-source entry in the current schema protocol.

## dataSourcePolicy

Supported policies:

- `preserve`
- `clear`
- `filter`
- `first`

These control what happens to the current value when the option list changes.

## x-reaction

The real shape is:

```json
{
  "x-reaction": {
    "display": {
      "type": "match",
      "dependencies": {
        "kind": "kind"
      },
      "match": {
        "email": "visible",
        "default": "none"
      }
    }
  }
}
```

### Supported Rule Types

- `static`
- `expression`
- `match`
- `computed`

### Supported Target Keys

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

## x-format

The shape is always:

```json
{
  "x-format": {
    "input": { ...rule },
    "output": { ...rule }
  }
}
```

### Actual Timing

- `input`: field creation, `form.setValues()`
- `output`: reading `form.values`, calling `form.submit()`

### Important Note

`x-format.input` does not automatically run on every user keystroke.

## x-validate

`x-validate` is a single rule or an array of rules:

```json
{
  "x-validate": {
    "type": "expression",
    "expression": "$value ? undefined : 'Required'"
  }
}
```

### Execution Order

Field validation runs in this order:

1. skip if `display === 'none'`
2. `required`
3. `validators`
4. `x-validate`

## form.values Boundary

`form.values` is the filtered and output-formatted result, not the raw value snapshot.

It excludes:

- fields with `display === 'none'`
- `void` nodes
- array child field paths

and applies `x-format.output` before returning the result.

## Recommended Reading Order

To understand the actual runtime behavior in detail, continue with:

- [Schema Protocol](/guide/schema-protocol)
- [x-reaction](/guide/advanced/x-reaction)
- [x-format](/guide/advanced/x-format)
- [x-validate](/guide/advanced/x-validate)
