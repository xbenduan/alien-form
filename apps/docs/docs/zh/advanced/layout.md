# 布局

布局组件使用 `type: "void"` — 不产生表单值，仅作为结构容器。

## Void 字段处理

`@alien-form/react` 中的 `SchemaFieldItem` 检测到 `type === 'void'` 时：
1. 在组件映射中查找 `component`
2. 将 `props` 和 `layoutProps` 作为 props 传入
3. 按 `order` 排序渲染子节点

## FormGrid

```json
{
  "type": "void",
  "component": "FormGrid",
  "props": { "columns": 3, "gap": 16 },
  "properties": { ... }
}
```

## FormLayout

```json
{
  "type": "void",
  "component": "FormLayout",
  "props": { "direction": "horizontal", "gap": 8 },
  "properties": { ... }
}
```

## FormSection

```json
{
  "type": "void",
  "title": "高级设置",
  "component": "FormSection",
  "props": { "bordered": true, "collapsible": true, "defaultCollapsed": true },
  "properties": { ... }
}
```

## `order` 排序

属性在渲染前按 `order` 排序（由 `getSortedEntries()` 和 `sortByXIndex()` 处理）：

```json
{
  "c": { "order": 2 },
  "a": { "order": 0 },
  "b": { "order": 1 }
}
```

渲染顺序：a → b → c

## Void 字段与 `form.values`

Void 字段通过 values getter 中的 `isVoidField()` 检查排除在 `form.values` 之外。
