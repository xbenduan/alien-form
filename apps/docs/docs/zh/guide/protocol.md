# 协议设计

FormBao 协议借鉴 Formily 的 Schema Form 思想，但不追求兼容。企业版协议强调可审计、可治理和低心智负担。

## 设计原则

- 去除 `x-*` 命名，使用自然字段名。
- 动态能力收敛到字段自有 `x-reaction`。
- `x-reaction` 只描述字段自身属性的派生，不跨字段控制。
- 内置 rule type 仅包含 `static`、`expression`、`match`、`computed`。
- core 不内置 URL 获取，不承载鉴权、网络和缓存策略。

## 示例

```json
{
  "component": "Select",
  "props": { "placeholder": "请选择" },
  "x-reaction": {
    "dataSource": {
      "dependencies": { "country": "country" },
      "type": "computed",
      "handler": "fetchCities"
    }
  }
}
```

## 为什么不做双层协议

双层协议会把“条件、分支、动作、目标字段”混在一起，难以审计。FormBao 选择主协议单层化：`x-reaction[key] = rule`，key 就是被派生的字段属性。
