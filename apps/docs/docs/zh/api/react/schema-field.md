# SchemaField

## 描述

`SchemaField` 是 `@alien-form/react` 中的 Schema 渲染器。它会调用 `form.setSchema(schema)`，并通过 `FieldRenderer` 和 `ArrayFieldRenderer` 渲染整个 Schema 树。

## 签名

```tsx
<SchemaField schema={schema} />
```

## 行为表现

- 按照 `order` 属性对根级别的 `properties` 进行排序。
- 在渲染时解析本地的 `#/definitions/Name` 引用。
- 将 `void` 类型的节点渲染为布局容器。
- 将没有指定组件的 `object` 节点渲染为透明的结构节点。
- 通过 `ArrayFieldRenderer` 渲染数组节点。

## 注意事项

- 改变 Schema 的引用会导致整个表单树被重建。
- 渲染过程和字段创建过程遵循相同的根级别 `definitions` 引用模型。
