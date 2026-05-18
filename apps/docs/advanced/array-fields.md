# Array Fields

Array fields are detected when `schema.type === 'array'` and `schema.items.properties` exists.

## How It Works

The `Field` class has built-in array support:

1. **`isArrayField`** — determined at construction time
2. **`_arrayRows`** — a signal tracking the current row count
3. **`value` getter** — dynamically collects values from child fields (`path.{index}.{key}`)
4. **`arrayItems` getter** — returns `IField[][]` (rows of child field instances)

## Schema Definition

```json
{
  "contacts": {
    "type": "array",
    "title": "Contacts",
    "x-component": "ArrayCards",
    "x-component-props": { "title": "Contact" },
    "x-validator": [{ "minItems": 1, "message": "At least one contact required" }],
    "items": {
      "properties": {
        "name": {
          "type": "string",
          "title": "Name",
          "required": true,
          "x-component": "Input",
          "x-decorator": "FormItem"
        },
        "phone": {
          "type": "string",
          "title": "Phone",
          "x-component": "Input",
          "x-decorator": "FormItem",
          "x-validator": [{ "format": "phone" }]
        }
      }
    }
  }
}
```

## Operations

### `push(initialValues?)`

Creates child fields for a new row at `_arrayRows` index:

```ts
field.push({ name: 'John', phone: '' })
```

### `remove(index)`

Removes child fields at `index`, then reindexes subsequent rows by recreating fields with shifted paths.

### `moveUp(index)` / `moveDown(index)`

Swaps values between two adjacent rows via `_swapRows()`.

## React Hook

```ts
const { field, items, push, remove, moveUp, moveDown } = useArrayField('contacts')

// items: IField[][] — each row is an array of child fields
// push/remove/moveUp/moveDown are pre-bound to the field
```

## ArrayFieldRenderer

The `react.tsx` `ArrayFieldRenderer` component:

1. Subscribes to both the field and the form
2. Checks `field.display` for visibility
3. Builds `rows` — renders each row's child fields via `FieldRenderer`
4. Passes `{ field, rows, onAdd, onRemove, onMoveUp, onMoveDown }` to the array component (e.g. `ArrayCards`)
5. Falls back to a simple add/remove list if no component is registered

## Initialization from `initialValues`

When `form.setSchema()` encounters an array field with existing `initialValues`, it pre-creates child fields:

```ts
const initialArr = getDeepValue(this._initialValues, path)
if (Array.isArray(initialArr)) {
  for (let i = 0; i < initialArr.length; i++) {
    for (const [childKey, childSchema] of Object.entries(itemProps)) {
      this.createField(`${path}.${i}.${childKey}`, childSchema, initialArr[i]?.[childKey])
    }
  }
}
```

## Validation

Array-level validators use `minItems`, `maxItems`, `uniqueItems`:

```json
{
  "type": "array",
  "minItems": 1,
  "maxItems": 5,
  "uniqueItems": true
}
```

These are checked by `runValidator()` in `field.ts`.
