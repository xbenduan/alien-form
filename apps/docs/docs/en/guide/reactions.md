# Reactions

Reactions are the runtime mechanism that derives field state from other field values.

## Mental Model

A reaction answers one question:

- when some dependency changes, what field property should be updated?

In AlienForm, the property key is explicit. The schema does not describe a generic effect system; it describes assignments to field state such as `display`, `pattern`, `title`, `props`, or `dataSource`.

## Supported Rule Types

| Type | Purpose |
| --- | --- |
| `static` | assign a fixed value |
| `expression` | compute a value from expression scope |
| `match` | choose a value by branch mapping |
| `computed` | delegate to a registered runtime handler |

## Dependency Resolution

Dependencies can be expressed as:

- an array, consumed as `$deps[index]`
- an object, consumed as `$deps.name`

Relative field paths such as `.source` are resolved from the current field's parent path.

## Why Reactions Stay Predictable

The current implementation does not expose an arbitrary imperative reaction DSL. Instead, it limits reactions to a known set of target keys and executes them through the `Form` model.

This keeps the reaction system inspectable and allows the core to report unsupported keys through `onError`.
