# 异步选项

FormBao core 不内置 URL 获取，也不提供独立的异步数据源字段。异步选项统一通过 `computed` reaction 调用应用层注册的 `handlers`。

## 注册 handler

```ts
const form = createForm({
  handlers: {
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

## Schema 写法

```json
{
  "type": "object",
  "properties": {
    "country": {
      "type": "string",
      "title": "国家",
      "component": "Select",
      "x-reaction": {
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

## 为什么这样设计

- 网络、鉴权、缓存、错误处理属于应用层职责。
- Schema 只描述字段属性如何派生，便于审计。
- core 保持纯净，不绑定 fetch、URL 白名单或响应转换协议。
