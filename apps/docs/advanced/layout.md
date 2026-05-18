# Layout

Layout components use `type: "void"` — they produce no form value and serve purely as structural containers.

## Void Field Handling

In `react.tsx`, `SchemaFieldItem` detects `type === 'void'` and:

1. Looks up the `x-component` in the registered components map
2. Passes `x-component-props` and `x-layout-props` as props
3. Renders children (sorted by `x-index`) inside the layout component

```tsx
// Simplified from react.tsx
if (schema.type === 'void' && schema.properties) {
  const LayoutComponent = components[schema['x-component']]
  const children = getSortedEntries(schema.properties).map(...)
  return <LayoutComponent {...layoutProps}>{children}</LayoutComponent>
}
```

## FormGrid

CSS Grid layout. Exported from `@formily-bao/ui`.

```json
{
  "grid": {
    "type": "void",
    "x-component": "FormGrid",
    "x-component-props": { "columns": 3, "gap": 16 },
    "properties": {
      "field1": { "type": "string", "x-component": "Input", "x-decorator": "FormItem" },
      "field2": { "type": "string", "x-component": "Input", "x-decorator": "FormItem" },
      "field3": { "type": "string", "x-component": "Input", "x-decorator": "FormItem" }
    }
  }
}
```

## FormLayout

Flex-based layout.

```json
{
  "row": {
    "type": "void",
    "x-component": "FormLayout",
    "x-component-props": { "direction": "horizontal", "gap": 8 },
    "properties": { ... }
  }
}
```

## FormSection

Bordered, collapsible section.

```json
{
  "section": {
    "type": "void",
    "title": "Advanced Settings",
    "x-component": "FormSection",
    "x-component-props": { "bordered": true, "collapsible": true, "defaultCollapsed": true },
    "properties": { ... }
  }
}
```

## `x-index` Ordering

Properties are sorted by `x-index` before rendering (handled by `getSortedEntries()` and `sortByXIndex()`):

```json
{
  "properties": {
    "c": { "x-index": 2, "type": "string", "x-component": "Input" },
    "a": { "x-index": 0, "type": "string", "x-component": "Input" },
    "b": { "x-index": 1, "type": "string", "x-component": "Input" }
  }
}
```

Renders in order: a → b → c.

## Nesting

Layouts can be freely nested:

```json
{
  "section": {
    "type": "void",
    "title": "Personal Info",
    "x-component": "FormSection",
    "properties": {
      "nameGrid": {
        "type": "void",
        "x-component": "FormGrid",
        "x-component-props": { "columns": 2 },
        "properties": {
          "firstName": { "type": "string", "title": "First", "x-component": "Input", "x-decorator": "FormItem" },
          "lastName": { "type": "string", "title": "Last", "x-component": "Input", "x-decorator": "FormItem" }
        }
      }
    }
  }
}
```

## Void Fields in `form.values`

Void fields are excluded from `form.values` via `isVoidField()` check in the values getter:

```ts
get values() {
  for (const [path, field] of this.fields) {
    if (!field.visible) continue
    if (this._isArrayChildPath(path)) continue
    if (isVoidField(path, this._schema)) continue
    setDeepValue(result, path, field.value)
  }
}
```
