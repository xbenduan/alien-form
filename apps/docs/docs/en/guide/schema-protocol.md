# Schema Protocol

AlienForm uses a JSON-schema-inspired protocol with runtime-specific extensions. The schema is the bridge between data structure, rendering, validation, and reactions.

## Root Shape

```ts
interface IFormSchema {
  type: 'object'
  properties?: Record<string, IFieldSchema>
  definitions?: Record<string, IFieldSchema>
}
```

## Standard Fields

The implementation supports a practical subset of JSON Schema concepts:

- `type`
- `title`
- `description`
- `default`
- `required`
- `enum`
- `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, `format`
- `properties`, `items`
- `definitions`, `$ref`

## AlienForm Extensions

The runtime extends schema with fields that directly map to the field model:

- `component`
- `props`
- `decorator`
- `decoratorProps`
- `state`
- `validators`
- `dataSource`
- `dataSourcePolicy`
- `x-reaction`
- `x-format`
- `x-validate`
- `content`
- `layoutProps`

## What The Protocol Is Responsible For

The protocol describes:

- field structure
- field ordering
- validation rules
- display and interaction state
- component mapping keys
- runtime value transformations
- derived field state

The protocol does not fetch remote schemas, does not register components by itself, and does not own transport logic.

## $ref Scope

The current implementation supports local references to root-level `definitions` using `#/definitions/Name`. More general JSON Pointer paths and remote schema references are not supported.
