# SchemaField

## Description

`SchemaField` is the schema rendering entry in `@alien-form/react`. It applies the incoming schema to the current `form` and then renders the field tree recursively.

## Signature

```tsx
<SchemaField schema={schema} />
```

## Behavior

- sorts root properties by `order`
- resolves local `#/definitions/Name` references for rendering
- renders `void` nodes as layout containers
- renders object nodes without components as transparent structure nodes
- renders array nodes and passes field instances down to children

## Relation to `form.setSchema()`

- when the `form` instance changes, the schema is applied to the new instance
- when the new schema is deeply equal to the previous one, the field tree is not rebuilt even if the object reference changed
- `form.setSchema(schema)` is only called again when the schema actually changes

## Notes

- `SchemaField` must be used inside `FormProvider`
- schema changes can rebuild the field tree, so pass a stable schema prop when possible
- rendering and field creation follow the same root `definitions` reference model
