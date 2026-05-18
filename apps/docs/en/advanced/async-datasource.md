# Async Options

FormBao core does not fetch URLs and does not expose a standalone async data source field. Async options are handled by `computed` reactions calling application-registered `reactionHandlers`.

## Register handlers

```ts
const form = createForm({
  reactionHandlers: {
    fetchCountries: async () => [
      { label: '中国', value: 'cn' },
      { label: '新加坡', value: 'sg' },
    ],
    fetchCities: async ({ deps }) => {
      if (!deps.country) return []
      return api.fetchCities(deps.country)
    },
  },
})
```

## Schema

```json
{
  "type": "object",
  "properties": {
    "country": {
      "type": "string",
      "title": "国家",
      "component": "Select",
      "reactions": {
        "dataSource": {
          "type": "computed",
          "handler": "fetchCountries"
        }
      }
    },
    "city": {
      "type": "string",
      "title": "城市",
      "component": "Select",
      "reactions": {
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

## Why this design

- Network, auth, cache, and error handling belong to the application layer.
- Schema only describes how field properties are derived, making it auditable.
- Core stays clean and does not bind to fetch, URL allowlists, or response adapter protocols.
