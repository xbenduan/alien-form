# 数组字段 (Array Fields)

数组字段被建模为一个父字段加上一组子行字段。

## 什么时候一个字段会成为数组字段

当满足以下条件时，Schema 节点将被视为数组字段：

- `type` 为 `array`
- `items` 是一个对象 Schema
- `items.properties` 存在

在这种模式下，该字段会暴露数组辅助方法，并且 React 层会通过 `ArrayFieldRenderer` 来渲染它。

## 运行时行为

数组字段支持以下操作：

- `push(initialValues?)`：添加一行
- `remove(index)`：移除指定行
- `moveUp(index)`：上移一行
- `moveDown(index)`：下移一行
- `arrayItems`：获取所有行项

## 标识规则 (Identity Rules)

移除某一行会原地重新索引后续的行字段，从而保留后续行的字段标识（Identity）。这对于订阅、校验状态以及行本地的元数据非常重要。

## 渲染器契约

像 `ArrayCards` 和 `ArrayTable` 这样的数组组件会接收到以下 props：

- `rows`
- `onAdd`
- `onRemove`
- `onMoveUp`
- `onMoveDown`
- `disabled`
- `readOnly`
- `readPretty`

这使得数组 UI 组件成为核心数组模型之上的一层很薄的表现层。
