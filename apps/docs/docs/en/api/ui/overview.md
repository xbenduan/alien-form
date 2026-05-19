# UI Overview

## Description

`@alien-form/ui` provides optional UI components used by the demo application and by schema-driven registration examples.

## Export Groups

- text inputs: `Input`, `Textarea`, `ItemInput`
- selection inputs: `Select`, `RadioGroup`, `Checkbox`, `Switch`, `Rating`, `DateInput`
- decorators and layout: `FormItem`, `FormGrid`, `FormLayout`, `FormSection`
- arrays: `ArrayCards`, `ArrayTable`
- primitives: `Button`, `Card`, `Tabs`, `ScrollArea`

## Integration Rule

The UI package is not special to the renderer. Components work because their registration keys match schema `component` and `decorator` values, and because they consume the normalized field props provided by the React renderer.
