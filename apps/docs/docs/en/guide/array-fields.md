# Array Fields

Array fields are modeled as a field plus a set of child row fields.

## When A Field Becomes An Array Field

A schema node is treated as an array field when:

- `type` is `array`
- `items` is an object schema
- `items.properties` exists

In that mode, the field exposes array helpers and the React layer renders it through `ArrayFieldRenderer`.

## Runtime Behavior

Array fields support:

- `push(initialValues?)`
- `remove(index)`
- `moveUp(index)`
- `moveDown(index)`
- `arrayItems`

## Identity Rules

Removing a row reindexes subsequent row fields in place, which preserves field identity for later rows. This matters for subscriptions, validation state, and row-local metadata.

## Renderer Contract

Array components such as `ArrayCards` and `ArrayTable` receive:

- `rows`
- `onAdd`
- `onRemove`
- `onMoveUp`
- `onMoveDown`
- `disabled`
- `readOnly`
- `readPretty`

This makes array UI components thin presentation layers on top of the core array model.
