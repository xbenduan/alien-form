# 企业安全策略

FormBao 的企业安全边界是：Schema 可以描述结构、校验和受控派生，但不能携带任意执行能力。

## Reaction 安全模型

```json
{
  "x-reaction": {
    "visible": {
      "dependencies": { "type": "type" },
      "type": "expression",
      "expression": "$deps.type === 'company'"
    },
    "dataSource": {
      "dependencies": { "country": "country" },
      "type": "computed",
      "handler": "fetchCities"
    }
  }
}
```

- `expression` 使用安全表达式，只允许表达式求值。
- `computed` 只能调用宿主应用显式注册的 handler。
- 远程请求、鉴权、缓存和降级逻辑由应用层 handler 管理。
- Schema 中不提供任意脚本执行入口。

## 推荐做法

| 场景 | 推荐协议 |
| --- | --- |
| 固定属性 | `type: "static"` |
| 条件显示 | `type: "expression"` 写入 `visible` 或 `display` |
| 枚举映射 | `type: "match"` 写入 `props`、`component` 等属性 |
| 异步选项 | `type: "computed"` 写入 `dataSource` |

## 禁止做法

- 在 schema 中描述 URL 请求。
- 在 schema 中写任意函数体或语句脚本。
- 通过一个字段直接控制其他字段。
- 把鉴权 token、内部接口地址等敏感信息写入 schema。
