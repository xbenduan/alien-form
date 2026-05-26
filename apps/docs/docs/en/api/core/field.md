# Field

## Description

This page documents the `IField` runtime object returned by `form.getField(path)`.

In the current model, application code should treat `IField` as the stable public contract rather than depending on a specific `Field` class implementation.

## Core Properties

| Property | Description |
| --- | --- |
| `path` | field path |
| `address` | runtime address of the field |
| `title` | field title |
| `description` | field description |
| `value` | current value |
| `initialValue` | initial value baseline |
| `display` | display state: `visible`, `hidden`, or `none` |
| `pattern` | interaction mode: `editable`, `readOnly`, `disabled`, or `readPretty` |
| `visible` | convenience boolean for `display === "visible"` |
| `hidden` | convenience boolean for `display === "hidden"` |
| `disabled` | whether the field is disabled |
| `readOnly` | whether the field is readonly |
| `readPretty` | whether the field is in presentation-only mode |
| `editable` | whether the field is editable |
| `required` | whether the field is required |
| `errors` | error list |
| `warnings` | warning list |
| `validateStatus` | current validation status |
| `component` | registered component key |
| `componentProps` | component prop bag |
| `decorator` | registered decorator key |
| `decoratorProps` | decorator prop bag |
| `dataSource` | normalized option list |
| `loading` | whether the field is currently loading async work |
| `data` | private field data bag |
| `content` | field content slot |

## Core Methods

| Method | Description |
| --- | --- |
| `setValue(value)` | update field value |
| `setErrors(errors)` | write the error list directly |
| `setWarnings(warnings)` | write the warning list directly |
| `validate()` | run field validation and return `FieldError[]` |
| `reset()` | restore the initial value |
| `setState(state)` | batch-update field mutable state |
| `setDataSource(ds)` | update the option list |
| `setLoading(loading)` | update loading state |
| `setDisplay(display)` | update display mode |
| `setPattern(pattern)` | update interaction mode |
| `setComponent(component, props?)` | update component and component props |
| `setDecorator(decorator, props?)` | update decorator and decorator props |
| `subscribe(listener)` | subscribe to field-level updates |
| `effect(runner)` | register a field-level reactive effect |

## Array-Field Capabilities

When the field is an array field, it also exposes:

- `isArrayField`
- `arrayItems`
- `push(initialValues?)`
- `remove(index)`
- `moveUp(index)`
- `moveDown(index)`

`arrayItems` is a two-dimensional field array where each row contains real child field instances.

## `field.effect` vs `form.effect`

- `field.effect(runner)`: good for observing local state on a single field
- `form.effect(selector, listener)`: good for cross-field or form-level derivation

If the logic coordinates multiple fields, it should usually live in `createForm({ setup }) + form.effect(...)` rather than being scattered across local field effects.

## Notes

- `IField` is a runtime object, not a static schema node.
- Fields with `display: "none"` do not appear in `form.values` and do not participate in validation.
- Fields with `display: "hidden"` still keep their values and still participate in validation.
- When you need imperative state adjustment, prefer `form.setFieldState(path, setter)` or the current field instance methods.
