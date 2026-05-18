# Layout

Layout components use `type: "void"` — they produce no form value and serve purely as structural containers.

## Void Field Handling

In `@formily-bao/react`, `SchemaFieldItem` detects `type === 'void'` and:

1. Looks up the `component` in the registered components map
2. Passes `props` and `layoutProps` as props
3. Renders children (sorted by `order`) inside the layout component

```tsx
// Simplified from react.tsx
if (schema.type === 'void' && schema.properties) {
  const LayoutComponent = components[schema['component']]
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
    "component": "FormGrid",
    "props": { "columns": 3, "gap": 16 },
    "properties": {
      "field1": { "type": "string", "component": "Input", "decorator": "FormItem" },
      "field2": { "type": "string", "component": "Input", "decorator": "FormItem" },
      "field3": { "type": "string", "component": "Input", "decorator": "FormItem" }
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
    "component": "FormLayout",
    "props": { "direction": "horizontal", "gap": 8 },
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
    "component": "FormSection",
    "props": { "bordered": true, "collapsible": true, "defaultCollapsed": true },
    "properties": { ... }
  }
}
```

## `order` Ordering

Properties are sorted by `order` before rendering (handled by `getSortedEntries()` and `sortByXIndex()`):

```json
{
  "properties": {
    "c": { "order": 2, "type": "string", "component": "Input" },
    "a": { "order": 0, "type": "string", "component": "Input" },
    "b": { "order": 1, "type": "string", "component": "Input" }
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
    "component": "FormSection",
    "properties": {
      "nameGrid": {
        "type": "void",
        "component": "FormGrid",
        "props": { "columns": 2 },
        "properties": {
          "firstName": { "type": "string", "title": "First", "component": "Input", "decorator": "FormItem" },
          "lastName": { "type": "string", "title": "Last", "component": "Input", "decorator": "FormItem" }
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
