# Imperative Logic

## The Scenario

You need to perform actions that are not strictly related to field state updates, such as logging analytics, showing toast notifications, or triggering global state changes when the form changes.

## The Anti-Pattern

Do not use React `useEffect` coupled with `useFormState` or `useField` to watch for changes, as this causes React to re-render excessively.

```tsx
// ❌ BAD: Causes full component tree re-renders on every keystroke
const { values } = useFormState()
useEffect(() => {
  console.log('Values changed', values)
}, [values])
```

## The Standard Pattern

Use the `effects` hook inside `createForm` to register lifecycle listeners directly on the core model.

```ts
import { createForm, onFieldValueChange, onFormSubmitSuccess } from '@alien-form/core'

const form = createForm({
  effects(form) {
    // Watch a specific field without re-rendering React
    onFieldValueChange('status', (field) => {
      if (field.value === 'completed') {
        toast.success('Status marked as completed!')
      }
    })

    // Handle successful submission
    onFormSubmitSuccess((form) => {
      analytics.track('form_submitted', form.values)
    })
  }
})
```

### Why do it this way?
- Logic runs outside the React render cycle, guaranteeing top performance.
- Event listeners are scoped to the form instance and automatically cleaned up.
- It keeps the schema pure and declarative, moving side-effects to the controller layer.
