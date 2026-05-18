# Components

All components are exported from `@formily-bao/ui` and registered via `FormProvider`.

## Form Controls

### Input

```json
{ "x-component": "Input", "x-component-props": { "placeholder": "...", "type": "text" } }
```

Supported `type`: `text`, `password`, `number`, `email`.

### Textarea

```json
{ "x-component": "Textarea", "x-component-props": { "rows": 4 } }
```

### Select

Options from `enum` or `x-data-source`:

```json
{
  "x-component": "Select",
  "enum": [
    { "label": "Option A", "value": "a" },
    { "label": "Option B", "value": "b" }
  ]
}
```

### Checkbox

```json
{ "type": "boolean", "x-component": "Checkbox" }
```

### Switch

```json
{ "type": "boolean", "x-component": "Switch" }
```

### RadioGroup

```json
{ "x-component": "RadioGroup", "enum": ["small", "medium", "large"] }
```

### DateInput

```json
{ "type": "date", "x-component": "DateInput" }
```

### Rating

```json
{ "type": "number", "x-component": "Rating", "x-component-props": { "max": 5 } }
```

## Array Components

### ArrayCards

Card-based repeatable layout. Receives `field`, `rows`, `onAdd`, `onRemove`, `onMoveUp`, `onMoveDown` from the renderer.

```json
{
  "type": "array",
  "x-component": "ArrayCards",
  "x-component-props": { "title": "Contact" },
  "items": {
    "properties": {
      "name": { "type": "string", "x-component": "Input", "x-decorator": "FormItem" },
      "phone": { "type": "string", "x-component": "Input", "x-decorator": "FormItem" }
    }
  }
}
```

### ArrayTable

Table-based repeatable layout.

```json
{
  "type": "array",
  "x-component": "ArrayTable",
  "items": {
    "properties": {
      "name": { "type": "string", "title": "Name", "x-component": "Input" },
      "qty": { "type": "number", "title": "Qty", "x-component": "Input" }
    }
  }
}
```

## Layout Components

Layout components use `type: "void"` — they don't produce form values.

### FormGrid

```json
{ "type": "void", "x-component": "FormGrid", "x-component-props": { "columns": 2, "gap": 16 } }
```

### FormLayout

```json
{ "type": "void", "x-component": "FormLayout", "x-component-props": { "direction": "horizontal", "gap": 8 } }
```

### FormSection

```json
{
  "type": "void",
  "title": "Section Title",
  "x-component": "FormSection",
  "x-component-props": { "bordered": true, "collapsible": true, "defaultCollapsed": false }
}
```

## Decorators

### FormItem

Standard field wrapper providing label, required indicator, errors, and description.

```json
{ "x-decorator": "FormItem" }
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
  ...componentProps  // from x-component-props
}
```
