# Components API

All UI components are exported from `@formily-bao/ui`, but when you integrate them with FormBao, the most important thing is the field contract passed by the React layer, not just each component's local props.

## Start With The Shared Contract

Normal field components registered through `FieldRenderer` receive at least this shape:

```ts
{
  value,
  onChange,
  disabled,
  readOnly,
  readPretty,
  loading,
  pattern,
  dataSource,
  ...field.componentProps,
}
```

That means:

- Components such as `Select`, `Checkbox`, `Switch`, and `Rating` can usually be registered directly.
- Native event-based inputs such as `Input` and `Textarea` need an adapter that turns `event.target.value` into `onChange(value)`.

## Text Inputs

### Input

Source type: `React.InputHTMLAttributes<HTMLInputElement>`.

Recommended adapter:

```tsx
const InputAdapter = ({ value, onChange, ...rest }: any) => (
  <Input
    value={value ?? ''}
    onChange={(event) => onChange(event.target.value)}
    {...rest}
  />
)
```

Good for normal text, number, and password inputs.

### Textarea

Source type: `React.TextareaHTMLAttributes<HTMLTextAreaElement>`.

```tsx
const TextareaAdapter = ({ value, onChange, ...rest }: any) => (
  <Textarea
    value={value ?? ''}
    onChange={(event) => onChange(event.target.value)}
    {...rest}
  />
)
```

### ItemInput

| props | Meaning |
| --- | --- |
| `value?: string[]` | Current chip list |
| `onChange?: (value: string[]) => void` | Value change callback |
| `placeholder?: string` | Placeholder |
| `maxItems?: number` | Maximum number of items |

Useful for tags, keywords, and whitelist-like string arrays.

## Choice And Boolean Inputs

### Select

| props | Meaning |
| --- | --- |
| `value?: any` | Current value |
| `onChange?: (value: any) => void` | Change callback |
| `dataSource?: SelectOption[]` | Option list |
| `multiple?: boolean` | Multiple selection |
| `placeholder?: string` | Placeholder text |
| `disabled?: boolean` | Disabled state |

- Supports single and multiple selection.
- Shows `No options` when `dataSource` is empty.

### RadioGroup

| props | Meaning |
| --- | --- |
| `value?: any` | Current value |
| `onChange?: (value: any) => void` | Change callback |
| `dataSource?: RadioOption[]` | Radio options |
| `direction?: 'horizontal' | 'vertical'` | Layout direction |

### Checkbox

| props | Meaning |
| --- | --- |
| `value?: boolean` | Checked state |
| `onChange?: (value: boolean) => void` | Toggle callback |
| `label?: string` | Inline label |
| `disabled?: boolean` | Disabled state |

### Switch

| props | Meaning |
| --- | --- |
| `value?: boolean` | Switch state |
| `onChange?: (value: boolean) => void` | Toggle callback |
| `disabled?: boolean` | Disabled state |

### Rating

| props | Meaning |
| --- | --- |
| `value?: number` | Current rating |
| `onChange?: (value: number) => void` | Rating callback |
| `max?: number` | Maximum score, default `5` |
| `size?: 'sm' | 'md' | 'lg'` | Size |
| `disabled?: boolean` | Disabled state |

### DateInput

| props | Meaning |
| --- | --- |
| `value?: string` | Date string |
| `onChange?: (value: string) => void` | Date change callback |
| `min?: string` / `max?: string` | Range limits |
| `placeholder?: string` | Placeholder |

## Decorator

### FormItem

`FormItem` is the current default decorator. `FieldRenderer` / `ArrayFieldRenderer` automatically inject:

- `label`
- `required`
- `errors`
- `warnings`
- `description`
- `validateStatus`
- `pattern`

Any custom decorator that supports this shape can plug into the current renderer.

## Layout Components

### FormGrid

| props | Meaning |
| --- | --- |
| `columns?: number` | Column count, default `2` |
| `gap?: number` | Gap multiplier, eventually multiplied by `4px` |
| `title?: string` | Small heading |
| `description?: string` | Description |

Best used under `type: 'void'` for multi-column form layout.

### FormLayout

| props | Meaning |
| --- | --- |
| `direction?: 'horizontal' | 'vertical'` | Layout direction |
| `gap?: number` | Gap multiplier |
| `title?: string` | Small heading |
| `description?: string` | Description |

### FormSection

| props | Meaning |
| --- | --- |
| `title?: string` | Section title |
| `description?: string` | Section description |
| `bordered?: boolean` | Whether to show a border |
| `collapsible?: boolean` | Whether the section is collapsible |
| `defaultCollapsed?: boolean` | Initial collapsed state |

## Array Components

### ArrayCards

| props | Meaning |
| --- | --- |
| `rows?: ReactNode[][]` | Already-rendered fields for each row |
| `onAdd` / `onRemove` / `onMoveUp` / `onMoveDown` | Array operation callbacks |
| `maxItems?: number` | Maximum item count |
| `addText?: string` | Add-button text |
| `disabled?: boolean` / `readOnly?: boolean` | State control |

This is a card-list UI and works well for contacts, addresses, and approval nodes.

### ArrayTable

Props are almost the same as `ArrayCards`, but the visual structure is row-based and better suited to line-item entry.

## Demo: Register Basic Inputs

```tsx
const components = {
  Input: ({ value, onChange, ...rest }: any) => (
    <Input
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    />
  ),
  Select,
  Checkbox,
  Switch,
  DateInput,
  RadioGroup,
  Rating,
}
```

## Demo: Layout And Array Fields

This schema fragment comes from `apps/demo/src/schema/02-layout-and-collections.json`:

```json
{
  "basicSection": {
    "type": "void",
    "title": "Basic Information",
    "component": "FormSection",
    "props": {
      "bordered": true,
      "collapsible": true
    },
    "properties": {
      "basicGrid": {
        "type": "void",
        "component": "FormGrid",
        "props": {
          "columns": 2,
          "gap": 4
        },
        "properties": {
          "projectName": {
            "type": "string",
            "title": "Project Name",
            "component": "Input",
            "decorator": "FormItem"
          },
          "riskLevel": {
            "type": "number",
            "title": "Risk Score",
            "component": "Rating",
            "decorator": "FormItem",
            "props": { "max": 5 }
          }
        }
      }
    }
  },
  "contacts": {
    "type": "array",
    "title": "Project Contacts",
    "component": "ArrayCards",
    "decorator": "FormItem",
    "props": { "addText": "+ Add Contact" }
  },
  "milestones": {
    "type": "array",
    "title": "Milestones",
    "component": "ArrayTable",
    "decorator": "FormItem",
    "props": { "addText": "+ Add Milestone" }
  }
}
```

## Demo: Display Mode And Dynamic Props

This fragment comes from `apps/demo/src/schema/06-state-and-display.json`:

```json
{
  "nickname": {
    "type": "string",
    "title": "Nickname",
    "component": "Input",
    "decorator": "FormItem",
    "x-reaction": {
      "pattern": {
        "type": "match",
        "dependencies": { "mode": "mode" },
        "match": {
          "readonly": "readPretty",
          "default": "editable"
        }
      },
      "props": {
        "type": "expression",
        "dependencies": { "mode": "mode" },
        "expression": "{ placeholder: $deps.mode === 'readonly' ? 'Read-only mode' : 'Enter a nickname' }"
      }
    }
  }
}
```

This example shows two important design points:

- Components do not need to understand the linkage protocol; they only consume the final `pattern`, `readPretty`, and `props`.
- The actual dynamic logic lives in `@formily-bao/core`, while UI components stay presentational.
