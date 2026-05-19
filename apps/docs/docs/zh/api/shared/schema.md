# Schema

## 描述

Schema 协议是核心模型与 React 渲染器之间共享的语言。它描述了表单结构、UI 注册键名、校验规则、格式化转换以及响应式联动。

## 构造形状

AlienForm 目前直接使用普通的 JSON 对象，而不是使用一个 `Schema` 类。实际的构造入口是传递给 `form.setSchema(schema)` 或 `<SchemaField schema={schema} />` 的根 Schema 对象。

## 核心属性

| 属性名 | 描述 |
| --- | --- |
| `type` | 字段 Schema 类型 |
| `title` | 字段标题 |
| `description` | 字段描述说明 |
| `default` | 默认值 |
| `properties` | 子级 Schema 映射 |
| `items` | 数组项的 Schema |
| `component` | 字段组件的注册键名 |
| `decorator` | 字段包装器的注册键名 |
| `props` | 传递给组件的属性 (props) |
| `decoratorProps` | 传递给包装器的属性 (props) |
| `validators` | 静态校验规则列表 |
| `state` | 初始的显示状态 (display) 和交互模式 (pattern) |
| `dataSource` | 数据源选项列表 |
| `x-reaction` | 运行时响应式联动规则 |
| `x-format` | 输入/输出的格式化规则 |
| `x-validate` | 动态校验规则 |
| `definitions` | 根级别的可复用 Schema 定义 |
| `$ref` | 针对 `#/definitions/Name` 的本地引用 |

## 行为说明

- `enum` 和 `dataSource` 最终都会被转换为 `field.dataSource`。
- `$ref` 仅支持本地引用，且只能引用根级别的 `definitions`。
- `void` 节点作为布局节点存在，它们不会为 `form.values` 贡献任何值。
