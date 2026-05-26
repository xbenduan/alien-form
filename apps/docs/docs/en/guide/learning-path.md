# Learning Path

The hardest part of learning AlienForm is not memorizing APIs. It is learning where logic belongs.

The recommended order is not “start in React and patch rules later”, but:

1. understand the headless runtime first
2. then understand schema
3. then connect React
4. only then move to patterns

## 1. Understand the Runtime Model First

Before writing any React code, understand the basic objects in `core`:

- **`createForm()`**: it returns a long-lived `IForm` runtime object
- **`IField`**: a field instance is a local runtime unit, not just an input widget
- **architecture boundaries**: read [Architecture](./architecture) and understand what belongs to schema, `setup`, React, and UI

The goal of this stage is to internalize one idea: form logic belongs to the runtime model before it belongs to the React page.

## 2. Learn the Schema Protocol

AlienForm is schema-driven, but schema is not an imperative workflow engine. It mainly describes structure and field-property derivation.

- **standard properties**: `type`, `title`, `description`, `required`, `default`
- **AlienForm extensions**: `component`, `decorator`, `x-reaction`, `x-format`, `x-validate`
- **recommended reading**: start with [Schema Protocol](./schema-protocol), then read [x-reaction](./advanced/x-reaction)

At this stage, the key idea is that `x-reaction` explains how properties of the current field are derived. It is not a cross-field command bus.

## 3. Connect React Afterwards

Once `core` and schema make sense, the React layer becomes much easier to understand.

Recommended order:

- **`useCreateForm`**: the default React entry point
- **`FormProvider`**: injects the form and component registries into context
- **`SchemaField`**: applies schema to the form and renders the field tree
- **custom components**: learn how to write UI adapters that obey the field contract

The key mental model here is: React is the binding layer, not the primary home of internal form rules.

## 4. Learn Logic Placement

This is the most important stage for real projects:

- **field-property derivation**: prefer [x-reaction](./advanced/x-reaction)
- **complex internal linkage**: prefer `createForm({ setup }) + form.effect(...)`
- **value formatting**: read [x-format](./advanced/x-format)
- **dynamic validation**: read [x-validate](./advanced/x-validate)
- **array modeling**: read [Array Fields](./array-fields)

If a rule is explaining the current field's `display`, `pattern`, `title`, or `dataSource`, it usually belongs in schema.

If a rule coordinates multiple fields, represents an internal form rule, or needs centralized effect registration and cleanup, it usually belongs in `setup`.

## 5. Read Patterns Last

At that point, the pattern docs become much easier to evaluate:

- [Edit Initialization](../patterns/edit-initialization)
- [Mode Switching](../patterns/mode-switching)
- [Permissions](../patterns/permissions)
- [Spec SKU Matrix](../patterns/spec-sku-matrix)

## One-Sentence Advice

Learn how schema describes fields first, then how `setup` hosts internal rules, and only then how React hooks bridge the form to the outside world.
