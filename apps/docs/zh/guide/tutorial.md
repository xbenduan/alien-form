# 教程

本教程展示一个最小的动态表单：根据联系人类型显示不同字段，并通过应用层 handler 加载选项。

## 创建表单

```ts
const form = createForm({
  reactionHandlers: {
    fetchCities: async ({ deps }) => {
      if (!deps.country) return []
      return api.fetchCities(deps.country)
    },
  },
})
```

## 编写 Schema

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
      "reactions": {
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

## 核心心智模型

1. 字段只派生自己的属性。
2. 依赖通过 `dependencies` 声明。
3. 简单逻辑用 `expression` 或 `match`。
4. 异步和复杂逻辑交给 `computed` handler。
