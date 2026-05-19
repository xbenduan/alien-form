# Architecture

AlienForm is organized as a layered runtime.

## Layers

### Core Layer

The core layer is framework-agnostic. It owns:

- form creation
- field creation
- subscriptions
- validation
- value formatting
- reaction execution
- array row management

### React Layer

The React layer consumes the core model and is responsible for:

- putting the form into context
- resolving schema trees into React elements
- subscribing components to field and form updates
- mapping field state into component props

### UI Layer

The UI layer provides optional components such as `Input`, `Select`, `FormItem`, `FormGrid`, `ArrayCards`, and `ArrayTable`. These components are not required by the core model, but they provide a default implementation for demos and product-facing forms.

## Why This Split Matters

- Logic is not tied to React components.
- Runtime behavior remains testable without rendering UI.
- Schema parsing rules can stay consistent across render layers.
- UI libraries can be swapped as long as they implement the component contract.

## Main Runtime Objects

| Object         | Role                                             |
| -------------- | ------------------------------------------------ |
| `Form`         | owns the field registry and top-level state      |
| `Field`        | stores state for a single path                   |
| `SchemaField`  | renders a schema tree through React              |
| `FormProvider` | connects form and component registries to the UI |

## Design Direction

The architecture is intentionally closer to a domain model than to a collection of hooks. The form is the primary runtime model, and React is a consumer of that model.
