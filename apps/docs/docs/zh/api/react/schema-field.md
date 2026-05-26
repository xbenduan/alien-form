# SchemaField

## 描述

`SchemaField` 是 `@alien-form/react` 的 schema 渲染入口。它会把传入的 schema 应用到当前 `form`，然后递归渲染字段树。

## 签名

```tsx
<SchemaField schema={schema} />
```

## 行为表现

- 按照 `order` 属性对根级别的 `properties` 进行排序。
- 在渲染时解析本地的 `#/definitions/Name` 引用。
- 将 `void` 类型的节点渲染为布局容器。
- 将没有指定组件的 `object` 节点渲染为透明的结构节点。
- 渲染数组节点，并把字段实例继续下传给子节点。

## 与 `form.setSchema()` 的关系

- 当 `form` 变更时，会重新把 schema 应用到新的实例上。
- 当传入 schema 与上一次深度等价时，即使对象引用变了，也不会重复重建字段树。
- 当 schema 真实发生变化时，才会重新执行 `form.setSchema(schema)`。

## 注意事项

- `SchemaField` 必须运行在 `FormProvider` 内部。
- schema 变化会影响字段树重建，因此建议把稳定 schema 作为 props 传入。
- 渲染过程和字段创建过程遵循相同的根级别 `definitions` 引用模型。
