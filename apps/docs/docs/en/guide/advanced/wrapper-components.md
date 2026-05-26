# Wrapper Components

Wrapper components are a special category in AlienForm: **their schema node type is `void` (no value output), but they can wrap child field trees that produce values**.

They are not simple "layout" — they are higher-order containers that organize structure and group value-producing children.

## Core Definition

```
void node + component + properties (containing value nodes) = Wrapper Component
```

- Does not participate in `form.values`
- Does not produce `value/onChange`
- But its children can be `object`, `array`, `string`, or any value type
- It controls children\'s layout, grouping, and visibility

## Difference from Field Components

| Dimension | Field Component | Wrapper Component |
| --- | --- | --- |
| schema type | `string` / `number` / `object` / `array` etc. | `void` |
| Produces value | Yes | No (values live on children) |
| Receives value/onChange | Yes | No |
| children | Usually none | Yes, recursively renders child fields |
| Typical use | Input, select, edit | Grouping, columns, cards, sections |

## Common Wrapper Components

| Component | Responsibility |
| --- | --- |
| `FormSection` | Title + description + card container |
| `FormGrid` | Grid multi-column layout |
| `FormLayout` | Direction and spacing control |
| `FormTab` / `FormStep` | Step/tab containers |

## Schema Example

```json
{
  "profile": {
    "type": "void",
    "title": "User Info",
    "component": "FormSection",
    "props": { "bordered": true },
    "properties": {
      "grid": {
        "type": "void",
        "component": "FormGrid",
        "props": { "columns": 2 },
        "properties": {
          "name": {
            "type": "string",
            "title": "Name",
            "component": "Input"
          },
          "age": {
            "type": "number",
            "title": "Age",
            "component": "NumberInput"
          }
        }
      }
    }
  }
}
```

`profile` and `grid` are both `void` wrapper nodes, **path-transparent**:

- Child paths: `name`, `age` (not `profile.grid.name`)
- `form.values`: `{ name: "...", age: ... }`
- `profile` and `grid` keys do not participate in path construction — they only serve as visual containers

Multi-level void nesting is also transparent — no matter how deep, value field paths always attach directly under the nearest non-void ancestor.

## Props Received by Wrapper Components

The React renderer passes these to wrapper components on `void` nodes:

```tsx
interface WrapperComponentProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  // ...all properties from schema.props
}
```

## Wrapper Component vs Transparent Object

| Situation | Type | Behavior |
| --- | --- | --- |
| `void + component` | Wrapper component | Has visible container, renders children |
| `object + properties` (no `component`) | Transparent structure | No container UI, path grouping only |
| `object + component + properties` | Container field | Has field instance + visible container + children contribute values to this object |

## Design Principles

1. **Wrapper components own structure, not values.** If a component needs `value/onChange`, it should not be on a `void` node.
2. **Don\'t turn wrappers into mega business components.** Even in complex pages, wrappers only do containment. Business logic belongs in children\'s `x-reaction` and `x-validate`.
3. **Wrappers can nest.** `FormSection > FormGrid > FormLayout` nesting is normal.

## When to Use Wrapper Components

**Use:**
- Grouping, sections, cards
- Multi-column grids
- Steps in a wizard
- Collapsible blocks
- Containers needing title/description but no value output

**Don\'t use:**
- You need to edit a value → use a field component
- You need to edit an object → use `object + component` container field
- You need to edit an array → use `array + items` array field
