# Learning Path

AlienForm is a powerful tool, but it introduces several new concepts compared to standard React state management. To master it efficiently, we recommend following this structured learning path.

## 1. Understand the Core Concepts

Before writing any React code, understand how AlienForm manages state independently:

- **Form Instance**: Read about how `createForm()` works and acts as the central hub.
- **Field Instance**: Learn how a `Field` represents a single form input and stores its value, errors, and UI state.
- **Architecture**: Review the [Architecture](./architecture) guide to see how the Core, React, and UI layers separate concerns.

## 2. Learn the Schema Protocol

AlienForm is schema-driven. You must be comfortable with JSON Schema and AlienForm's extensions.

- **Standard Properties**: `type`, `title`, `description`, `required`, `default`.
- **AlienForm Extensions**: `component`, `decorator`, `x-reaction`, `x-validator`.
- Read the [Schema Protocol](./schema-protocol) guide thoroughly.

## 3. Master React Bindings

Learn how to connect the core model and schema to React:

- **FormProvider**: How to inject the form and component registries.
- **SchemaField**: How it translates a JSON schema into a tree of React components.
- **Custom Components**: Learn how to write adapters so your UI components can consume `value` and `onChange`.

## 4. Explore Advanced Features

Once you can build static forms, move on to dynamic behaviors:

- **Field-state linkage**: Read [x-reaction](./advanced/x-reaction) to understand how runtime state such as `display`, `pattern`, `value`, and `dataSource` is derived.
- **Value formatting protocol**: Read [x-format](./advanced/x-format) to understand the actual boundary between input-state and output-state conversion.
- **Dynamic validation protocol**: Read [x-validate](./advanced/x-validate) to understand cross-field validation, async validation, and error return rules.
- **Array Fields**: Learn how to manage lists of data with `ArrayCards` or `ArrayTable`.
