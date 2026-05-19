# Field

## Description

`Field` is the smallest reactive state unit in AlienForm. Each field corresponds to a path and stores value, display state, interaction mode, validation result, and component metadata.

## Core Properties

| Property         | Description                                         |
| ---------------- | --------------------------------------------------- |
| `path`           | dot-path of the field                               |
| `value`          | current value                                       |
| `display`        | `visible`, `hidden`, or `none`                      |
| `pattern`        | `editable`, `readOnly`, `disabled`, or `readPretty` |
| `component`      | registered component key                            |
| `componentProps` | component prop bag                                  |
| `decorator`      | registered decorator key                            |
| `dataSource`     | normalized option list                              |
| `errors`         | validation errors                                   |
| `validateStatus` | field validation status                             |

## Core Methods

| Method                | Description                       |
| --------------------- | --------------------------------- |
| `setValue(value)`     | update the field value            |
| `setState(partial)`   | batch-update field state          |
| `validate()`          | run static and dynamic validation |
| `reset()`             | restore the initial value         |
| `subscribe(listener)` | subscribe to field-level updates  |

## Array Methods

When the field is an array field, it also exposes:

- `push(initialValues?)`
- `remove(index)`
- `moveUp(index)`
- `moveDown(index)`
- `arrayItems`
