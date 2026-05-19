# SchemaField

## Description

`SchemaField` is the schema renderer in `@alien-form/react`. It calls `form.setSchema(schema)` and renders the schema tree with `FieldRenderer` and `ArrayFieldRenderer`.

## Signature

```tsx
<SchemaField schema={schema} />
```

## Behavior

- sorts root properties by `order`
- resolves local `#/definitions/Name` references for rendering
- renders `void` nodes as layout containers
- renders object nodes without components as transparent structure nodes
- renders array nodes through `ArrayFieldRenderer`

## Notes

- changing the schema reference causes the form tree to be rebuilt
- rendering and field creation follow the same root `definitions` reference model
