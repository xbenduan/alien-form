# 联动协议

AlienForm 的 `x-reaction` 是**字段自有、属性级**的派生规则。字段只声明“自己的某个属性如何从依赖中计算出来”，不再跨字段控制其他字段。

## 基本结构

```json
{
  "type": "string",
  "title": "邮箱",
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
}
```

## 内置类型

AlienForm 只内置四种 reaction rule：

- `static`：直接写入固定值。
- `expression`：执行安全表达式，表达式是原始字符串，不使用双花括号包裹。
- `match`：根据依赖值做枚举映射。
- `computed`：调用应用层注册的 `handlers`，用于异步数据或复杂计算。

## 属性级派生

```json
{
  "x-reaction": {
    "display": {
      "dependencies": { "enabled": "enabled" },
      "type": "expression",
      "expression": "$deps.enabled ? 'visible' : 'none'"
    },
    "props": {
      "dependencies": { "mode": "mode" },
      "type": "match",
      "source": "$deps.mode",
      "match": {
        "readonly": { "placeholder": "只读模式" },
        "default": { "placeholder": "可编辑模式" }
      }
    }
  }
}
```

## 异步数据

核心不内置 URL 请求。需要加载远程选项时，由应用层注册 handler：

```ts
const form = createForm({
  handlers: {
    fetchCities: async ({ deps }) => api.getCities(deps.country),
  },
})
```

```json
{
  "x-reaction": {
    "dataSource": {
      "dependencies": { "country": "country" },
      "type": "computed",
      "handler": "fetchCities"
    }
  }
}
```

## 设计约束

- 不支持跨字段控制。
- 不支持分支式动作协议。
- 不支持 schema 内任意脚本执行。
- 不在 core 内做 URL fetch。
- 动态行为全部通过字段自有属性派生表达。
