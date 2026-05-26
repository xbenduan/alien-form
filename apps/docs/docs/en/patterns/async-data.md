# Async Data

## Scenario

A select-like field needs async options, and those options may depend on another field such as `country`.

## Anti-Pattern

Do not fetch options inside React components and push them down as ad hoc props. That mixes UI bridging with business async behavior.

## Standard Pattern

Use `x-reaction` to declare that `dataSource` is derived by a handler. The schema describes the dependency and the target property, while the handler performs the async work.

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
        { "label": "USA", "value": "us" },
        { "label": "China", "value": "cn" }
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

Register the `fetchStates` function in form configuration. The handler receives runtime context and returns the new `dataSource` value.

```ts
const form = createForm({
  handlers: {
    fetchStates: async ({ deps }) => {
      if (!deps.country) return [];

      const response = await fetch(`/api/states?country=${deps.country}`);
      const data = await response.json();

      return data.map((item) => ({ label: item.name, value: item.code }));
    },
  },
});
```

## Why this is the recommended pattern

- Schema stays declarative: it only references the dependency and handler name.
- Async implementation stays in business handlers instead of leaking request details into schema.
- `dataSource` updates automatically when its dependency changes.
- React only renders the result and does not become the scheduler of async option loading.

## One-Sentence Rule

Let schema declare which field property is derived, and let handlers own the async implementation.
