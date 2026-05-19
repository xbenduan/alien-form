# Custom Components

Extend AlienForm with custom field components and decorators.

## Component Contract

Every component receives these props from `FieldRenderer` in `@alien-form/react`:

```ts
{
  value: any               // field.value
  onChange: (val) => void  // calls field.setValue(val)
  disabled: boolean        // field.disabled
  readOnly: boolean        // field.readOnly
  readPretty: boolean      // field.readPretty
  loading: boolean         // field.loading
  pattern: string          // field.pattern
  dataSource?: Array<{label, value}>  // if field.dataSource.length > 0
  ...field.componentProps  // from props
}
```

## Example: Color Picker

```tsx
function ColorPicker({ value, onChange, disabled, presets = [] }) {
  return (
    <div>
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {presets.map(color => (
        <button key={color} onClick={() => onChange(color)} disabled={disabled}>
          <span style={{ background: color, width: 16, height: 16 }} />
        </button>
      ))}
    </div>
  )
}
```

## Registration

```tsx
<FormProvider
  form={form}
  components={{ Input, Select, ColorPicker }}
  decorators={{ FormItem }}
>
  <SchemaField schema={schema} />
</FormProvider>
```

## Usage in Schema

```json
{
  "brandColor": {
    "type": "string",
    "title": "Brand Color",
    "component": "ColorPicker",
    "decorator": "FormItem",
    "props": {
      "presets": ["#ff0000", "#00ff00", "#0000ff"]
    }
  }
}
```

## ReadPretty Support

When `field.pattern === 'readPretty'`, the `FieldRenderer` looks for:

1. `components['ComponentName.ReadPretty']`
2. `components['ReadPretty.ComponentName']`

```tsx
ColorPicker.ReadPretty = ({ value }) => (
  <span style={{ background: value, padding: '2px 8px' }}>{value}</span>
)

// Register:
components={{ ColorPicker, 'ColorPicker.ReadPretty': ColorPicker.ReadPretty }}
```

## Custom Decorators

Decorators wrap the component with label, errors, and layout. They receive:

```ts
{
  label: string           // field.title
  required: boolean       // field.required
  errors: FieldError[]    // field.errors
  warnings: FieldError[]  // field.warnings
  description: string     // field.description
  validateStatus: string  // field.validateStatus
  pattern: string         // field.pattern
  children: ReactNode     // the rendered component
  ...field.decoratorProps // from decoratorProps
}
```

Example:

```tsx
function InlineDecorator({ children, label, required, errors }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label>{required && '*'}{label}</label>
      {children}
      {errors?.[0] && <span style={{ color: 'red' }}>{errors[0].message}</span>}
    </div>
  )
}
```

## Using FieldContext

Custom components can access the full field instance:

```tsx
import { useField } from '@alien-form/react'

function SmartInput(props) {
  const field = useField()
  // Access field.data, field.dataSource, etc.
  return <input {...props} />
}
```
