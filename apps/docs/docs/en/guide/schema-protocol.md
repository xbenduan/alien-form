# Schema Protocol

AlienForm's Schema is a protocol compiled by core into a field tree and runtime rules. It combines three parts:

- **Static structure**: field paths, nesting, array items
- **Runtime projection**: components, decorators, initial state, data sources
- **Dynamic rules**: `x-reaction`, `x-format`, `x-validate`

## Root Node

```ts
interface IFormSchema {
  type: "object";
  properties?: Record<string, IFieldSchema>;
  definitions?: Record<string, IFieldSchema>;
}
```

Entry points: `form.setSchema(schema)` or `<SchemaField schema={schema} />`.

Execution: clear old fields → cache `definitions` → sort by `order` → recursively create field tree → install `x-reaction`.

---

## Complete Field Property Reference

### JSON Schema Standard Subset

| Field | Type | Description | Runtime Mapping |
| --- | --- | --- | --- |
| `type` | `SchemaTypes` | Field type: `string` \| `number` \| `boolean` \| `object` \| `array` \| `void` \| `date` \| `datetime` | Determines node behavior (value / layout / array) |
| `title` | `string` | Field title | → `field.title` |
| `description` | `string` | Field description | → `field.description` |
| `default` | `any` | Default value; lower priority than `initialValues` | → `field.initialValue` (after `x-format.input`) |
| `required` | `boolean \| string[]` | Whether required. On root node, `string[]` specifies which children are required | → `field.required` + built-in required validator |
| `minimum` | `number` | Min value (`>=`) | → validator |
| `maximum` | `number` | Max value (`<=`) | → validator |
| `exclusiveMinimum` | `number` | Exclusive min (`>`) | → validator |
| `exclusiveMaximum` | `number` | Exclusive max (`<`) | → validator |
| `multipleOf` | `number` | Must be a multiple of this value | → validator |
| `minLength` | `number` | Min string length | → validator |
| `maxLength` | `number` | Max string length | → validator |
| `pattern` | `string` | Regex pattern (string form) | → validator |
| `format` | `ValidatorFormats` | Predefined format: `email` \| `url` \| `phone` \| `number` \| `integer` \| `idcard` \| `ip` \| `ipv6` \| `zip` | → validator |
| `minItems` | `number` | Min array items | → validator |
| `maxItems` | `number` | Max array items | → validator |
| `uniqueItems` | `boolean` | Require unique array items | → validator |
| `const` | `any` | Value must strictly equal this constant | → validator |
| `properties` | `Record<string, IFieldSchema>` | Object child properties | → recursive child field creation |
| `items` | `IFieldSchema` | Array item schema | → array row template |
| `$ref` | `string` | Reference root-level `definitions`, format: `#/definitions/Name` | → expanded and merged into current node |

### AlienForm Extension Fields

| Field | Type | Description | Runtime Mapping |
| --- | --- | --- | --- |
| `order` | `number` | Render sort weight (lower = earlier) | → field creation order |
| `component` | `string` | Component registry key (looked up in `components`) | → `field.component` |
| `props` | `Record<string, any>` | Props passed to the component | → `field.componentProps` |
| `decorator` | `string` | Decorator registry key (looked up in `decorators`) | → `field.decorator` |
| `decoratorProps` | `Record<string, any>` | Props passed to the decorator | → `field.decoratorProps` |
| `state` | `Partial<{display, pattern, disabled, readOnly, readPretty, editable}>` | Initial field state declaration | → `field.display` + `field.pattern` |
| `validators` | `Validator \| Validator[]` | Static validation rules (function or rule object) | → validation step 3 |
| `dataSource` | `Array<{label, value, ...}>` | Static option source, normalized before entering runtime | → `field.dataSource` |
| `dataSourcePolicy` | `"preserve" \| "clear" \| "filter" \| "first"` | How to handle current value when dataSource changes | → value reconciliation after dataSource update |
| `content` | `any` | Content slot (passed to component) | → `field.content` |
| `data` | `Record<string, any>` | Private data slot | → `field.data` |
| `x-reaction` | `SchemaReactions` | Dynamic field property derivation rules (see [x-reaction](./advanced/x-reaction)) | → reactive effects |
| `x-format` | `{input?: SchemaRuleSet, output?: SchemaRuleSet}` | Value input/output transformation (see [x-format](./advanced/x-format)) | → field creation + `form.values` read |
| `x-validate` | `SchemaRuleSet` | Dynamic validation rules (see [x-validate](./advanced/x-validate)) | → validation step 4 |

### `state` Field Details

`state` is the initial state declaration entry:

| Property | Type | Mapping |
| --- | --- | --- |
| `display` | `"visible" \| "hidden" \| "none"` | → `field.display`. `none` excludes from `form.values` and validation |
| `pattern` | `"editable" \| "readOnly" \| "disabled" \| "readPretty"` | → `field.pattern` |
| `disabled` | `boolean` | `true` → `pattern: "disabled"` |
| `readOnly` | `boolean` | `true` → `pattern: "readOnly"` |
| `readPretty` | `boolean` | `true` → `pattern: "readPretty"` |
| `editable` | `boolean` | `false` → `pattern: "readOnly"` |

Priority: `pattern` > `readPretty` > `readOnly` > `disabled` > `editable`.

### `dataSourcePolicy` Details

When `dataSource` updates via linkage or async loading and the current value is no longer in the new options:

| Policy | Behavior |
| --- | --- |
| `preserve` | Keep current value unchanged (default) |
| `clear` | Clear to `undefined` if value not in new options |
| `filter` | For array values, filter out items not in new options |
| `first` | Select first option if value not in new options |

---

## Node Type Semantics

### `object`

| Mode | Condition | Behavior |
| --- | --- | --- |
| Container field | Has `component` | Creates field instance + recurses into children |
| Transparent group | No `component` | Path prefix only, no field created, React renders children directly |

### `void`

Layout node. Does not contribute to `form.values`, but can carry `component`, `props`, `title`, `content`, and recursively renders children.

### `array`

| Mode | Condition | Behavior |
| --- | --- | --- |
| Complex array | `items` has `properties` | Creates array field + expands child field tree per row |
| Simple array | `items` lacks `properties` | Creates array field only, no row field expansion |

Array row field path format: `arrayPath.{index}.childKey`.

---

## Rule Model (SchemaXRule)

`x-reaction`, `x-format`, and `x-validate` share the same rule types:

| Type | Structure | Description |
| --- | --- | --- |
| `static` | `{ type: "static", value: any }` | Returns a fixed value |
| `expression` | `{ type: "expression", expression: string }` | Restricted expression evaluation (no function calls, no assignments) |
| `match` | `{ type: "match", source?: string, match: Record<string, any> }` | Branch mapping, `source` is optional |
| `computed` | `{ type: "computed", handler: string, params?: Record<string, any> }` | Calls a function from `createForm({ handlers })` |

Each rule can include `dependencies` (`string[]` or `Record<string, string>`) to declare dependent fields.

### Expression Context

| Variable | Meaning |
| --- | --- |
| `$self` | Current field instance |
| `$form` | Form instance |
| `$values` | Values snapshot |
| `$deps` | Dependency values (array for array deps, object for object deps) |
| `$dependencies` | Dependency values object |
| `$value` | Current field value |
| *scope-injected vars* | From `createForm({ scope })` |

---

## `$ref` and `definitions`

Only supports `"$ref": "#/definitions/Name"`. `definitions` can only be declared on root `IFormSchema`.

Merge rule: local properties override referenced properties.

```json
{ "$ref": "#/definitions/UserName", "title": "Applicant Name" }
```

→ `title` overrides the original title from definitions.

---

## `form.values` Output Rules

`form.values` is not a raw value snapshot but a filtered submission object:

1. Excludes fields with `display === "none"`
2. Excludes `void` nodes
3. Excludes array child paths (array field aggregates row values)
4. Applies `x-format.output` to each output value

> `display: "hidden"` fields still participate in `form.values` and validation.
