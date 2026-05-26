# Custom Components

Custom components in AlienForm are not magic. They are simply:

1. a name-to-React-component mapping registered in `FormProvider`
2. a schema node that references that name through `component` or `decorator`
3. a React renderer that converts field state into a unified prop contract

This page explains the **real runtime mechanism**, not an abstract idea.

## Registration Entry

The actual registration entry in React is `FormProvider`.

```tsx
<FormProvider form={form} components={components} decorators={decorators}>
  <SchemaField schema={schema} />
</FormProvider>
```

Where:

- `components`: field components and layout components
- `decorators`: wrapper components

You can inspect the real demo registration in `apps/demo/src/components/schema-renderer.tsx`.

For example:

```tsx
const components = {
  Input,
  Select,
  ImageInput,
  SkuTable,
  FormLayout,
  FormGrid,
  FormSection,
};

const decorators = {
  FormItem,
};
```

## Contract of Normal Field Components

For normal field components, the contract is intentionally simple. The React layer maps the field into unified props such as:

- `value`
- `onChange`
- `disabled`
- `readOnly`
- `readPretty`
- `loading`
- `pattern`
- `dataSource` when available
- any properties expanded from `componentProps`

So a custom field component should usually look like this:

```tsx
interface ImageInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}
```

instead of inventing its own protocol.

## Recommended Pattern

The cleanest example in the repository is the demo `ImageInput`, implemented in `apps/demo/src/components/image-input.tsx`.

Its characteristics:

- edits a single field value
- uses standard `value/onChange`
- can have enhanced visuals without creating extra field structure

Its schema usage looks like:

```json
{
  "image": {
    "type": "string",
    "title": "Spec Image",
    "component": "ImageInput",
    "decorator": "FormItem",
    "props": {
      "placeholder": "Enter image URL"
    }
  }
}
```

## Anti-Pattern

### Do not pack multi-field business data into one object-value component

This is usually not recommended:

```tsx
interface ProductEditorProps {
  value?: {
    name: string;
    price: number;
    stock: number;
  };
  onChange?: (value: any) => void;
}
```

If those values require:

- independent paths
- independent validation
- independent reactions
- independent error display

then they should remain a field tree, not an object-value component.

The pattern guide explains this boundary in more detail:

- [Composite Field Modeling](../../patterns/composite-fields)

## Decorator Components

If your goal is not to change the field input itself, but to change the outer wrapper, such as:

- label
- error display
- helper text
- permission wrapper

then you should usually create a `decorator`, not a custom field component.

For example:

```json
{
  "name": {
    "type": "string",
    "component": "Input",
    "decorator": "FormItem"
  }
}
```

The React renderer will first render the field component and then wrap it with the decorator.

## Custom Array Components

Array components are also custom components, but they do not follow the normal field contract.

When a schema node satisfies:

- `type: "array"`
- `items.properties` exists

the React layer uses `ArrayFieldRenderer`, and the array component receives array-specific props:

- `field`
- `rows`
- `onAdd`
- `onRemove`
- `onMoveUp`
- `onMoveDown`
- `disabled`
- `readOnly`
- `readPretty`

This means an array component is a presentation layer on top of the array field model, not an owner of the list state.

## Recommended Array Component Pattern

Typical basic array components:

- `ArrayCards`
- `ArrayTable`

An advanced array component example is `SkuTable`, implemented in `apps/demo/src/components/sku-table.tsx`.

The important part about `SkuTable` is not that it looks like a table. The important part is that:

- it consumes `field` and `field.arrayItems`
- it renders real fields cell by cell
- it does not own the business derivation logic of `skus`

So the array component should not be responsible for:

- generating the Cartesian product
- assembling one giant business object
- defining the derivation rule from `specs` to `skus`

Those belong to the form controller or `setup + form.effect(...)`.

## Current Rendering Pipeline

In this project, the custom-component call chain is roughly:

1. `FormProvider` injects `components/decorators`
2. `SchemaField` calls `form.setSchema(schema)`
3. `SchemaFieldItem` dispatches by schema node type
4. normal fields go through `FieldRenderer`
5. array fields go through `ArrayFieldRenderer`
6. rendering finally resolves `components[field.component]`

Key entry: `packages/react/src/index.tsx`.

## When to Create a Custom Component

Good candidates:

- the standard input does not satisfy your visual or interaction need
- you need a single-value input with richer visuals, such as image URL preview
- you need a special renderer for an array field, such as a sales matrix table

Bad candidates:

- you only want grouping, cards, grids, or layout
- you only want shared labels and error rendering
- the real target is still a multi-field business tree

In those cases, prefer:

- layout components
- decorator components
- schema field trees plus controller logic

## One-Sentence Rule

**Custom field components should still obey the field protocol: normal fields consume `value/onChange`, and array fields consume `rows/onAdd/onRemove`. The UI can be complex, but it should not bypass the field tree.**
