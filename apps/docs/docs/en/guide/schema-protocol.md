# Schema Protocol

AlienForm's schema is not just a generic form description language. It is a protocol that the core layer directly compiles into a field tree and runtime rules. In practice, it combines three parts:

- static structure: paths, nesting, and array item structure
- runtime projection: `component`, `decorator`, `state`, `dataSource`, `validators`
- dynamic rules: `x-reaction`, `x-format`, `x-validate`

This page follows the **actual implementation in this repository**, with emphasis on how the schema is interpreted, created, and executed at runtime.

## Root Shape

There are only two real schema entry points:

- `form.setSchema(schema)`
- `<SchemaField schema={schema} />`

The root type is always `object`:

```ts
interface IFormSchema {
  type: "object";
  properties?: Record<string, IFieldSchema>;
  definitions?: Record<string, IFieldSchema>;
}
```

There is no `Schema` class in the current implementation. The runtime consumes a plain JSON object.

## What Schema Actually Does

When a schema is passed into the form, the core layer does the following:

1. clears old fields and old reactions
2. caches root-level `definitions`
3. sorts `properties` by `order`
4. recursively creates the field tree
5. installs `x-reaction` runners after field creation finishes

So schema is not just a rendering-time description. It is compiled into the actual runtime model.

## Supported Primitive Types

The current repository supports:

- `string`
- `number`
- `boolean`
- `object`
- `array`
- `void`
- `date`
- `datetime`

The real runtime behavior depends not only on `type`, but also on whether the node has a `component`, child `properties`, or structured `items`.

## Standard Field Subset

AlienForm supports a practical subset of JSON Schema:

- `type`
- `title`
- `description`
- `default`
- `required`
- `minimum`
- `maximum`
- `minLength`
- `maxLength`
- `pattern`
- `format`
- `properties`
- `items`
- `definitions` (root only)
- `$ref`

These fields are not preserved as-is forever. They are translated into field state, validators, and runtime structure.

## Runtime Extension Fields

Compared with plain JSON Schema, AlienForm adds:

- `state`
- `validators`
- `component`
- `props`
- `decorator`
- `decoratorProps`
- `dataSource`
- `dataSourcePolicy`
- `x-reaction`
- `x-format`
- `x-validate`
- `content`
- `data`

The most important categories are:

- rendering projection: `component`, `decorator`, `props`, `decoratorProps`
- field state: `state`, `dataSource`, `validators`
- dynamic protocols: `x-reaction`, `x-format`, `x-validate`

## Actual Node Semantics

### object nodes

`object` has two modes.

First: **object with `component`**

- creates a real field instance
- still recursively creates child properties
- useful when the object itself is also rendered by a container component

Second: **object without `component`**

- acts only as a path container
- does not create a standalone field instance
- React renders only its children

So an `object` node is not always a visible UI container. It can be only a structural grouping path.

### void nodes

`void` is the layout node type.

Its core meaning is:

- it is used for layout components, sections, cards, grids, and wrappers
- it does not contribute a value to `form.values`
- it can still carry `component`, `props`, `title`, `description`, and `content`
- it still recursively renders child properties

So `void` is primarily a layout protocol, not a value protocol.

### array nodes

`array` also has two common modes.

First: `items` is an object schema with `properties`

- creates the array field
- creates child row fields for each row
- מתאים to tables, cards, line items, and row collections

Second: `items` is not an object structure

- behaves as a simple array field
- does not expand into a complex row field tree

The actual editable units inside array rows are child fields such as `users.0.name`, not a single large row object.

## How Fields Are Created

When creating a field, the core layer resolves the initial value in this order:

1. `initialValues`
2. `schema.default`

After that, it applies `x-format.input` and then constructs the `Field` instance.

The `Field` then projects the following runtime data from schema:

- `title`
- `description`
- `display`
- `pattern`
- `component`
- `componentProps`
- `decorator`
- `decoratorProps`
- `dataSource`
- `validators`
- `x-validate`

So many schema fields become runtime field state rather than staying as raw config only.

## The Real Meaning of state

`state` is not an independent subsystem. It is the canonical entry for initial field state.

Display state values are:

- `visible`
- `hidden`
- `none`

Interaction state values are:

- `editable`
- `readOnly`
- `disabled`
- `readPretty`

In other words:

- `display` owns visibility: `visible | hidden | none`
- `pattern` owns interaction mode: `editable | readOnly | disabled | readPretty`

## The Real Role of component and decorator

In schema, `component` and `decorator` are not JSX. They are registry keys.

For example:

```json
{
  "component": "Input",
  "decorator": "FormItem"
}
```

At runtime, AlienForm does this:

- looks up `Input` in the `components` registry
- looks up `FormItem` in the `decorators` registry
- renders them with props generated from field runtime state

So schema describes component identity, not component implementation.

## dataSource

`dataSource` is the only option-source entry in the current schema protocol.

Before reaching the field model, the option list is normalized:

- strings and numbers become `{ label, value }`
- `{ key, title }` is also converted into the standard shape
- the final result is always a normalized option array

That is why select-like components always receive a consistent option structure.

## The Role of dataSourcePolicy

When reactions or async loading replace a `dataSource`, the current field value may no longer exist in the new option list. The current implementation uses `dataSourcePolicy` to control what happens next.

Supported strategies:

- `preserve`
- `clear`
- `filter`
- `first`

Typical cases:

- sub-category depends on category
- multi-select options refresh from remote data
- deciding whether old values should be kept after source replacement

## definitions and $ref

The repository intentionally keeps `$ref` support narrow.

### Supported scope

Only this shape is supported:

```json
{ "$ref": "#/definitions/Name" }
```

And `definitions` can only be declared on the root `IFormSchema`; declaring it inside field nodes has no effect.

Not supported:

- remote references
- arbitrary JSON Pointer
- non-root paths
- cross-file references

### Merge rule

After `$ref` is expanded, local fields override referenced fields. For example:

```json
{
  "$ref": "#/definitions/UserName",
  "title": "Applicant Name"
}
```

The local `title` overrides the title from the definition.

### Why React also resolves $ref

The render layer needs the expanded node shape to decide whether a node is `void`, `object`, `array`, or a normal field.

If only the core layer expands `$ref` during field creation but React still renders the unresolved raw node, then:

- layout nodes can enter the wrong render branch
- fields expanded from `$ref` can become non-interactive

That is why the React layer in this project also resolves `$ref` before rendering.

## x-reaction

`x-reaction` drives field property linkage.

The real supported shape is not `target`-based. It is:

```json
{
  "x-reaction": {
    "display": {
      "type": "match",
      "dependencies": {
        "contactType": "contactType"
      },
      "match": {
        "email": "visible",
        "default": "none"
      }
    }
  }
}
```

That means:

- the key itself is the target property
- `dependencies` is the real dependency declaration field
- expressions are plain JS expression strings
- supported rule types are `static`, `expression`, `match`, and `computed`

Typical uses:

- visibility switching
- dynamic title / description / props
- computed `value`
- async `dataSource`
- `pattern` switching

## x-format

`x-format` is for value conversion, not UI linkage.

Its shape is always:

```json
{
  "x-format": {
    "input": { ...rule },
    "output": { ...rule }
  }
}
```

### Actual boundary

- `input` runs only during field creation and `form.setValues()`
- `output` runs only when reading `form.values` and when calling `form.submit()`
- normal user typing does not re-run `input`
- `x-format` must stay synchronous and cannot return Promises

Good fits:

- currency conversion
- enum mapping
- default-value and submit-value transformation
- synchronous normalization

## x-validate

`x-validate` describes dynamic validation.

It is itself a single rule or rule array:

```json
{
  "x-validate": {
    "type": "expression",
    "dependencies": {
      "password": "password"
    },
    "expression": "$value === $deps.password ? undefined : 'Values do not match'"
  }
}
```

### Validation order

Field validation follows this order:

1. skip when `display === 'none'`
2. `required`
3. static `validators`
4. `x-validate`

### Return value semantics

- `undefined` / `null` / `true`: pass
- `false`: fail without a specific message
- `string`: becomes the error message
- `object` / `array`: normalized into error items

### Trigger timing

It does not run automatically on every keystroke. It runs only during:

- `field.validate()`
- `form.validate()`
- `form.submit()`

## What form.values Really Is

This is one of the most important boundaries.

`form.values` is not a raw snapshot of every field value. It is the final submission-oriented value object after:

- removing fields with `display === 'none'`
- removing `void` nodes
- removing array child paths
- applying `x-format.output`

That means:

- fields with `display: 'none'` do not appear in `form.values`
- fields with `display: 'hidden'` still remain in `form.values`
- `void` nodes never appear in `form.values`
- array child fields are not emitted separately because the array field already aggregates row values

## Responsibility Boundary

Schema is responsible for:

- field structure
- value paths
- component registry keys
- initial state
- static validation
- dynamic linkage
- value conversion
- dynamic validation

Schema is not responsible for:

- remote schema fetching
- automatic component registration
- transport logic
- global side-effect orchestration
- application workflows outside the field model

If a requirement is not essentially about field structure or field-state derivation, it usually does not belong inside schema.

## How To Think About AlienForm Schema

The most accurate mental model is:

> AlienForm schema is not just declarative UI config. It is a runtime protocol that the core compiles into a field model, state model, and lightweight rule engine.

Once that clicks, the boundary behavior becomes much easier to reason about:

- why `void` does not show up in `form.values`
- why `display: 'none'` affects both value output and validation
- why `x-format.input` does not run on every keystroke
- why `$ref` must be resolved in both core and React
