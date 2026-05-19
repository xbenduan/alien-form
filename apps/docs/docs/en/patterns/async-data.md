# Async Data Fetching

## The Scenario

A dropdown list (Select component) needs to fetch its options from an API. Furthermore, the options might need to change based on another field (e.g., selecting a Country fetches the corresponding States).

## The Anti-Pattern

Do not fetch data inside React components and try to pass it down as props.

## The Standard Pattern

Use a `computed` reaction to fetch data and assign it to the field's `dataSource`.

### 1. Define the Schema

```json
{
  "type": "object",
  "properties": {
    "country": {
      "type": "string",
      "title": "Country",
      "component": "Select",
      "dataSource": [
        {"label": "USA", "value": "us"},
        {"label": "China", "value": "cn"}
      ]
    },
    "state": {
      "type": "string",
      "title": "State",
      "component": "Select",
      "x-reaction": {
        "dataSource": {
          "type": "computed",
          "dependencies": { "country": "country" },
          "handler": "fetchStates"
        }
      }
    }
  }
}
```

### 2. Implement the Handler

Register the `fetchStates` function in the form configuration. The `computed` handler receives a context object rather than raw `deps`. It must return the new value for the target property, which in this case is an array of options.

```ts
const form = createForm({
  handlers: {
    fetchStates: async ({ deps }) => {
      if (!deps.country) return [];
      
      const response = await fetch(`/api/states?country=${deps.country}`)
      const data = await response.json()
      
      return data.map(item => ({ label: item.name, value: item.code }))
    }
  }
})
```

### Why do it this way?
- Data fetching logic is cleanly separated from the UI components.
- The `dataSource` is automatically updated whenever the dependency (`country`) changes.
- The React layer automatically re-renders the `Select` component when its `dataSource` is updated by the core model.
