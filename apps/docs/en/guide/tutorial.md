# Tutorial

This tutorial shows a minimal dynamic form: fields derive their own properties from dependencies, and async options are loaded by application-level handlers.

## Create a form

```ts
const form = createForm({
  handlers: {
    fetchCities: async ({ deps }) => {
      if (!deps.country) return []
      return api.fetchCities(deps.country)
    },
  },
})
```

## Write schema

```json
{
  "type": "object",
  "properties": {
    "contactType": {
      "type": "string",
      "title": "联系方式",
      "component": "Select",
      "dataSource": [
        { "label": "邮箱", "value": "email" },
        { "label": "电话", "value": "phone" }
      ]
    },
    "email": {
      "type": "string",
      "title": "邮箱",
      "component": "Input",
      "x-reaction": {
        "visible": {
          "dependencies": { "contactType": "contactType" },
          "type": "expression",
          "expression": "$deps.contactType === 'email'"
        },
        "required": {
          "dependencies": { "contactType": "contactType" },
          "type": "expression",
          "expression": "$deps.contactType === 'email'"
        }
      }
    },
    "country": { "type": "string", "component": "Select" },
    "city": {
      "type": "string",
      "component": "Select",
      "x-reaction": {
        "dataSource": {
          "dependencies": { "country": "country" },
          "type": "computed",
          "handler": "fetchCities"
        }
      }
    }
  }
}
```

## Mental model

1. A field only derives its own properties.
2. Dependencies are declared with `dependencies`.
3. Use `expression` or `match` for simple logic.
4. Use `computed` handlers for async or complex logic.
