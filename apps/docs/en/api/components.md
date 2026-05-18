# Components

All components are exported from `@formily-bao/ui` and registered via `FormProvider`.

## Form Controls

### Input

```json
{ "component": "Input", "props": { "placeholder": "...", "type": "text" } }
```

Supported `type`: `text`, `password`, `number`, `email`.

### Textarea

```json
{ "component": "Textarea", "props": { "rows": 4 } }
```

### Select

Options from `enum` or `dataSource`:

```json
{
  "component": "Select",
  "enum": [
    { "label": "Option A", "value": "a" },
    { "label": "Option B", "value": "b" }
  ]
}
```

### Checkbox

```json
{ "type": "boolean", "component": "Checkbox" }
```

### Switch

```json
{ "type": "boolean", "component": "Switch" }
```

### RadioGroup

```json
{ "component": "RadioGroup", "enum": ["small", "medium", "large"] }
```

### DateInput

```json
{ "type": "date", "component": "DateInput" }
```

### Rating

```json
{ "type": "number", "component": "Rating", "props": { "max": 5 } }
```

## Array Components

### ArrayCards

Card-based repeatable layout. Receives `field`, `rows`, `onAdd`, `onRemove`, `onMoveUp`, `onMoveDown` from the renderer.

```json
{
  "type": "array",
  "component": "ArrayCards",
  "props": { "title": "Contact" },
  "items": {
    "properties": {
      "name": { "type": "string", "component": "Input", "decorator": "FormItem" },
      "phone": { "type": "string", "component": "Input", "decorator": "FormItem" }
    }
  }
}
```

### ArrayTable

Table-based repeatable layout.

```json
{
  "type": "array",
  "component": "ArrayTable",
  "items": {
    "properties": {
      "name": { "type": "string", "title": "Name", "component": "Input" },
      "qty": { "type": "number", "title": "Qty", "component": "Input" }
    }
  }
}
```

## Layout Components

Layout components use `type: "void"` — they don't produce form values.

### FormGrid

```json
{ "type": "void", "component": "FormGrid", "props": { "columns": 2, "gap": 16 } }
```

### FormLayout

```json
{ "type": "void", "component": "FormLayout", "props": { "direction": "horizontal", "gap": 8 } }
```

### FormSection

```json
{
  "type": "void",
  "title": "Section Title",
  "component": "FormSection",
  "props": { "bordered": true, "collapsible": true, "defaultCollapsed": false }
}
```

## Decorators

### FormItem

Standard field wrapper providing label, required indicator, errors, and description.

```json
{ "decorator": "FormItem" }
```

The `FieldRenderer` in `@formily-bao/react` passes these props to the decorator automatically:

- `label` — from `field.title`
- `required` — from `field.required`
- `errors` — from `field.errors`
- `warnings` — from `field.warnings`
- `description` — from `field.description`
- `validateStatus` — from `field.validateStatus`
- `pattern` — from `field.pattern`

## Component Props Contract

Every component registered with FormBao receives:

```ts
{
  value: any
  onChange: (val: any) => void
  disabled: boolean
  readOnly: boolean
  readPretty: boolean
  loading: boolean
  pattern: FieldPatternTypes
  dataSource?: Array<{ label: string; value: any }>
  ...componentProps  // from props
}
```
