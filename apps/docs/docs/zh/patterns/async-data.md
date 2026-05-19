# 异步数据获取

## 场景

一个下拉列表（Select 组件）需要从 API 获取它的选项数据。更进一步，这些选项可能需要根据另一个字段的选择而发生改变（例如，选择了“国家”后，去获取对应的“州/省份”数据）。

## 反模式 (Anti-Pattern)

**不要**在 React 组件内部去拉取数据，并尝试将其作为 props 传递下去。

## 标准范式

使用 `computed` 类型的联动规则来获取数据，并将其赋值给字段的 `dataSource` 属性。

### 1. 定义 Schema

```json
{
  "type": "object",
  "properties": {
    "country": {
      "type": "string",
      "title": "国家",
      "component": "Select",
      "dataSource": [
        {"label": "美国", "value": "us"},
        {"label": "中国", "value": "cn"}
      ]
    },
    "state": {
      "type": "string",
      "title": "州/省份",
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

### 2. 实现处理函数 (Handler)

在表单配置中注册 `fetchStates` 函数。`computed` 处理器接收的是一个上下文对象，而不是裸的 `deps`。它必须返回目标属性的新值，在这个例子中就是一个选项数组。

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

### 为什么这样做？
- 数据获取逻辑与 UI 组件干净地分离开了。
- 每当依赖项（`country`）发生变化时，`dataSource` 都会被自动更新。
- 当核心模型更新了 `dataSource` 后，React 层会自动重新渲染该 `Select` 组件。
