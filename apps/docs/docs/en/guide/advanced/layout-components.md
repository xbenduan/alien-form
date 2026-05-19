# Layout Components

In AlienForm, layout components are not field inputs. They are visual containers for schema structure nodes.

The most common layout components are:

- `FormLayout`
- `FormGrid`
- `FormSection`

They are typically used for:

- titles and descriptions
- card-like grouping
- columns and grids
- spacing and arrangement

## Core Idea

In the current implementation, the most typical way to mount a layout component is:

- the schema node type is `void`
- the node has `properties`
- the node declares a `component`

For example:

```json
{
  "profile": {
    "type": "void",
    "title": "User Info",
    "component": "FormSection",
    "props": {
      "bordered": true
    },
    "properties": {
      "grid": {
        "type": "void",
        "component": "FormGrid",
        "props": {
          "columns": 2,
          "gap": 4
        },
        "properties": {
          "name": {
            "type": "string",
            "component": "Input",
            "decorator": "FormItem"
          }
        }
      }
    }
  }
}
```

## The Real Meaning of `void`

The key characteristics of a `void` node are:

- it mainly exists for layout responsibility
- it should not become part of business values
- it may carry `title`, `description`, `component`, and `props`
- it continues to render child nodes recursively

The React layer treats it as a layout container rather than as a normal input field.

## What Props Layout Components Receive

In the current React renderer, when a `void` node is processed, the layout component receives:

- `schema.props`
- `schema.title`
- `schema.description`
- `children`

So a layout component usually looks like:

```tsx
interface FormLayoutProps {
  title?: string
  description?: string
  children?: React.ReactNode
}
```

For example, the UI package `FormLayout` is implemented in `packages/ui/src/components/form-layout.tsx`.

Its job is simply:

- render title and description
- control `direction` and `gap`
- place child fields into a container

## What Layout Components Should Not Do

Layout components should not:

- own form values
- define `value/onChange`
- generate child fields themselves
- perform business derivation logic

In short, a layout component is a container, not a business editor.

## `void` vs Transparent `object`

These two are easy to mix up:

### 1. `void + component`

This is the standard layout node.

- it has a visible container
- it has title and description
- it has its own component
- it still renders child fields

### 2. `object + properties` without `component`

This is a transparent structure node.

- it has no dedicated layout component
- it does not produce its own visible container
- it only groups field paths
- it directly renders child nodes recursively

For example:

```json
{
  "address": {
    "type": "object",
    "properties": {
      "city": {
        "type": "string",
        "component": "Input"
      },
      "street": {
        "type": "string",
        "component": "Input"
      }
    }
  }
}
```

Here, `address` is only a path prefix, not a layout component.

## Recommended Use Cases

Good use cases for layout components:

- section grouping
- card containers
- grid layouts
- carrying titles and descriptions
- organizing complex form structure

Bad use cases:

- you actually need to edit a real value
- you need `value/onChange`
- you want to wrap a multi-field business object into one component

If the goal is to edit actual data, go back to field components.

## Common Layout Combinations

The most common layout combination in this repository is:

- `FormSection`: section block and description
- `FormGrid`: multi-column layout
- `FormLayout`: direction and spacing

You can inspect the canonical demo example in `apps/demo/src/schema/02-layout-and-collections.json`.

This is one of the most standard layout schema examples in the repository.

## Boundary Between Layout Components and Custom Components

If you are building:

- a titled card
- a grouping container
- a section shell with description
- a purely visual wrapper

then it is probably a layout component.

If you are building:

- an editor for one value
- a selector for one value
- an editor for an array field
- a row-level editable structure

then it is more likely a field component or an array component.

## Their Role in Advanced Scenarios

Even in complex scenarios such as a spec and SKU sales matrix, layout components still only belong to the structure layer.

For example:

- `specs` and `skus` are real field trees
- `SkuTable` is an array-field renderer
- any outer section or grouping shell is still just a layout component

Do not turn layout components into mega business components just because the page is complex.

## One-Sentence Rule

**Layout components only own structure and containers, not business values. `void` nodes carry layout, while real data should still live on child field paths.**
