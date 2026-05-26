# Architecture

The key architectural question in AlienForm is not only how many layers exist, but where each kind of logic should live.

Once that boundary is clear, many common questions answer themselves:

- why internal linkage should not default to React `useEffect`
- why `core` must not depend on React components
- why async business work should not be embedded into schema

## Three Layers

### Core Layer

`@alien-form/core` is the framework-agnostic headless runtime. It owns:

- `createForm()` and the `IForm` runtime
- field-tree creation and maintenance
- `x-reaction`, `x-format`, and `x-validate` execution
- reactive rules driven by `form.effect(...)`
- validation, submission, and array-field behavior

This layer knows nothing about React and never holds React component instances.

### React Layer

`@alien-form/react` connects the core runtime to React and mainly provides:

- `useCreateForm`
- `FormProvider`
- `SchemaField`
- hooks such as `useForm`, `useFieldState`, and `useFormEffect`

Its job is binding and bridging, not owning internal business rules.

### UI Layer

`@alien-form/ui` provides default component implementations such as:

- `Input`
- `Select`
- `FormItem`
- `FormGrid`
- `ArrayCards`
- `ArrayTable`

These are only default presentation components. They can be replaced and do not define what the core runtime is allowed to do.

## Where Logic Should Live

### In schema

Schema is the right place for:

- field structure
- titles, descriptions, components, and decorators
- field-property derivation based on dependency values
- value formatting rules
- validation rules

In short, schema explains how the current field behaves.

### In `setup`

`createForm({ setup })` is the right place for:

- complex internal form linkage
- derivation that depends on multiple fields
- internal rules that do not fit cleanly into a single field's `x-reaction`
- effects that need registration and cleanup within form lifecycle

The standard pattern here is `setup + form.effect(...)`.

### In React

React is the right place for:

- route params and page-level mode changes
- external state synchronization
- page effects, logging, and analytics
- submit buttons, validate buttons, and other view-level bridges

React is the host layer. It should not become the scheduler of internal form rules.

## Main Runtime Objects

| Object | Role |
| --- | --- |
| `IForm` | top-level runtime object that owns field registry, value tree, validation, and effect APIs |
| `IField` | per-field runtime object with local state, array helpers, and field-level effects |
| `FormProvider` | injects form and component registries into React context |
| `SchemaField` | applies schema to the form and renders the field tree recursively |

## Why This Split Matters

- core stays testable without UI
- React remains a binding layer instead of part of the model layer
- UI can be swapped without changing protocol or runtime semantics
- `setup` attaches directly to the reactive graph, which is more stable than patch-style React linkage

## One-Sentence Summary

The essence of AlienForm architecture is: schema handles field derivation, `setup` handles internal rules, React handles view bridges, and UI handles final presentation.
