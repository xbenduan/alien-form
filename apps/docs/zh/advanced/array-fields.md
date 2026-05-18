# 数组字段

当 `schema.type === 'array'` 且 `schema.items.properties` 存在时，识别为数组字段。

## 工作原理

`Field` 类内置数组支持：

1. **`isArrayField`** — 构造时确定
2. **`_arrayRows`** — signal 追踪当前行数
3. **`value` getter** — 从子字段动态收集值
4. **`arrayItems` getter** — 返回 `IField[][]`

## Schema 定义

```json
{
  "contacts": {
    "type": "array",
    "title": "联系人",
    "component": "ArrayCards",
    "props": { "title": "联系人" },
    "validators": [{ "minItems": 1, "message": "至少添加一个联系人" }],
    "items": {
      "properties": {
        "name": { "type": "string", "title": "姓名", "required": true, "component": "Input", "decorator": "FormItem" },
        "phone": { "type": "string", "title": "电话", "component": "Input", "decorator": "FormItem" }
      }
    }
  }
}
```

## 操作

- **`push(initialValues?)`** — 在末尾创建新行的子字段
- **`remove(index)`** — 删除指定行并重建后续行索引
- **`moveUp(index)` / `moveDown(index)`** — 交换相邻行的值

## React Hook

```ts
const { field, items, push, remove, moveUp, moveDown } = useArrayField('contacts')
```

## 验证

数组级验证器：`minItems`、`maxItems`、`uniqueItems`。

```json
{ "type": "array", "minItems": 1, "maxItems": 5, "uniqueItems": true }
```
