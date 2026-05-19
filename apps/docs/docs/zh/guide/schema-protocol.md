# Schema 协议

AlienForm 使用了一种受 JSON-Schema 启发的协议，并带有针对运行时的特定扩展。Schema 是数据结构、渲染、校验和联动之间的桥梁。

## 根节点结构

```ts
interface IFormSchema {
  type: 'object'
  properties?: Record<string, IFieldSchema>
  definitions?: Record<string, IFieldSchema>
}
```

## 标准字段

当前实现支持 JSON Schema 概念的一个实用子集：

- `type`
- `title`
- `description`
- `default`
- `required`
- `enum`
- `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, `format`
- `properties`, `items`
- `definitions`, `$ref`

## AlienForm 扩展

运行时通过直接映射到字段模型的属性来扩展 Schema：

- `component`
- `props`
- `decorator`
- `decoratorProps`
- `state`
- `validators`
- `dataSource`
- `dataSourcePolicy`
- `x-reaction`
- `x-format`
- `x-validate`
- `content`
- `layoutProps`

## 协议的职责

该协议用于描述：

- 字段结构
- 字段顺序
- 校验规则
- 显示和交互状态
- 组件映射键
- 运行时值的转换
- 派生的字段状态

该协议不负责获取远程 Schema，不自行注册组件，也不拥有数据传输逻辑。

## $ref 的作用域

当前的实现仅支持使用 `#/definitions/Name` 对根级别的 `definitions` 进行本地引用。不支持更通用的 JSON Pointer 路径和远程 Schema 引用。
