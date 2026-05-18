# Async Data Source

Load remote options using `x-async-data-source`. Implemented in `Form._setupSingleAsyncDataSource()`.

## Configuration

```ts
interface AsyncDataSource {
  url?: string
  method?: 'GET' | 'POST'
  params?: Record<string, any>
  headers?: Record<string, string>
  data?: Record<string, any>
  service?: ((params) => Promise<Array<{label, value}>>) | string
  transformResponse?: ((response) => Array<{label, value}>) | string
  dependencies?: Record<string, string> | string[]
  fetchOnMount?: boolean
}
```

## Basic Usage (Service Registry)

```json
{
  "country": {
    "type": "string",
    "title": "Country",
    "x-component": "Select",
    "x-decorator": "FormItem",
    "x-async-data-source": {
      "service": "fetchCountries"
    }
  }
}
```

```ts
const form = createForm({
  services: {
    fetchCountries: async () => {
      const res = await fetch('/api/countries')
      return res.json() // [{ label: "China", value: "cn" }, ...]
    }
  }
})
```

## With Dependencies (Cascading)

```json
{
  "city": {
    "type": "string",
    "x-component": "Select",
    "x-async-data-source": {
      "service": "fetchCities",
      "dependencies": ["country"]
    }
  }
}
```

```ts
services: {
  fetchCities: async (deps) => {
    // deps = { country: "cn" }
    const res = await fetch(`/api/cities?country=${deps.country}`)
    return res.json()
  }
}
```

When `country` field value changes, the `effect()` re-runs and triggers `doFetch()` with updated dependency values.

## URL-Based Fetching

```json
{
  "x-async-data-source": {
    "url": "/api/options",
    "method": "GET",
    "headers": { "Authorization": "Bearer ..." },
    "transformResponse": "toOptions"
  }
}
```

```ts
const form = createForm({
  transformers: {
    toOptions: (json) => json.data.map(item => ({ label: item.name, value: item.id }))
  }
})
```

## Loading State

While fetching, `field.setLoading(true)` is called. Components receive `loading` prop:

```ts
// In the renderer:
componentProps.loading = field.loading
```

## `fetchOnMount`

Controls whether to fetch on initial render (default: `true`). Set to `false` to only fetch when dependencies change:

```json
{
  "x-async-data-source": {
    "service": "fetchCities",
    "dependencies": ["country"],
    "fetchOnMount": false
  }
}
```

## Implementation Details

From `form.ts`:

```ts
private _setupSingleAsyncDataSource(targetPath, config) {
  const field = this.fields.get(targetPath)

  const doFetch = async (deps) => {
    field.setLoading(true)
    try {
      let result
      if (config.service) {
        // Call registered service function
        result = await this._config.services[config.service](deps)
      } else if (config.url) {
        // HTTP fetch with template resolution
        const response = await fetch(resolveTemplate(config.url, deps))
        const json = await response.json()
        result = config.transformResponse
          ? this._config.transformers[config.transformResponse](json)
          : json
      }
      field.setDataSource(result)
    } finally {
      field.setLoading(false)
    }
  }

  if (config.dependencies) {
    // Wrap in effect() — re-runs when dependency field values change
    effect(() => {
      const deps = /* resolve dep field values */
      doFetch(deps)
    })
  } else if (config.fetchOnMount !== false) {
    doFetch({})
  }
}
```
