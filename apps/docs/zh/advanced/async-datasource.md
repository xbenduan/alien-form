# 异步数据源

使用 `asyncDataSource` 加载远程选项。由 `Form._setupSingleAsyncDataSource()` 实现。

## 配置

```ts
interface AsyncDataSource {
  url?: string
  method?: 'GET' | 'POST'
  params?: Record<string, any>
  headers?: Record<string, string>
  service?: ((params) => Promise<Array<{label, value}>>) | string
  transformResponse?: ((response) => Array<{label, value}>) | string
  dependencies?: Record<string, string> | string[]
  fetchOnMount?: boolean
}
```

## 基本用法

```json
{
  "country": {
    "type": "string",
    "component": "Select",
    "asyncDataSource": { "service": "fetchCountries" }
  }
}
```

```ts
const form = createForm({
  services: {
    fetchCountries: async () => {
      const res = await fetch('/api/countries')
      return res.json()
    }
  }
})
```

## 依赖级联

```json
{
  "city": {
    "component": "Select",
    "asyncDataSource": {
      "service": "fetchCities",
      "dependencies": ["country"]
    }
  }
}
```

`country` 值变化时，`effect()` 重新运行并触发 `doFetch()`。

## URL 获取

```json
{
  "asyncDataSource": {
    "url": "/api/options",
    "method": "GET",
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

## 加载状态

获取过程中 `field.setLoading(true)` 被调用，组件接收 `loading` prop。

## `fetchOnMount`

默认 `true`。设为 `false` 则仅在依赖变化时获取。
