# Architecture

AlienForm's architecture is about "which layer owns which logic".

## Three Layers

### Core (`@alien-form/core`)

Framework-agnostic headless runtime:

- `createForm()` → `IForm`
- Field tree creation and maintenance
- `x-reaction` / `x-format` / `x-validate` execution
- `form.effect(...)` reactive rules
- Validation, submission, array fields

No React dependency, no component instances.

### React (`@alien-form/react`)

Binding layer — does not host internal business rules:

- `useCreateForm` / `useForm`
- `FormProvider` — injects form + component registry
- `SchemaField` — applies schema and renders field tree
- `useFieldState` / `useFormEffect` / `useFormWatch` hooks

### UI (`@alien-form/ui`)

Default component implementations, entirely replaceable:

- Field components: `Input` / `Select` / `Switch` …
- Layout components: `FormGrid` / `FormSection` / `FormLayout`
- Array components: `ArrayCards` / `ArrayTable`

## Where Should Logic Go?

### Schema

- Field structure, title, component, decorator
- Dependency-based property derivation (`x-reaction`)
- Value formatting (`x-format`)
- Dynamic validation (`x-validate`)

### `createForm({ setup })`

- Complex internal form linkage
- Multi-field coordination
- Effects that need registration/cleanup

```ts
createForm({
  setup(form) {
    form.effect(
      (f) => f.getField("country")?.value,
      (country) => {
        // linkage logic
      }
    );
  }
});
```

### React Layer

- Page-level params, routing
- External state sync
- Submit buttons and other view interactions

## Why This Split

- Core can be tested without UI
- React doesn't become part of the model layer
- UI is replaceable without affecting the protocol
- `setup` hooks into the reactive graph — more stable than React `useEffect` patches
