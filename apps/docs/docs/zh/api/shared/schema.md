# Schema

## 描述

Schema 协议是 `@alien-form/core` 与 `@alien-form/react` 共享的结构描述语言。AlienForm 当前没有 `Schema` 类，运行时直接消费普通 JSON 对象。

Schema 的真实入口有两个：

- `form.setSchema(schema)`
- `<SchemaField schema={schema} />`

## 根结构

```ts
interface IFormSchema {
  type: "object";
  properties?: Record<string, IFieldSchema>;
  definitions?: Record<string, IFieldSchema>;
}
```

## IFieldSchema 组成

`IFieldSchema` 可以理解为三层信息的组合：

- JSON Schema 子集：`type`、`default`、`required`、`minimum` 等
- UI 投影字段：`component`、`props`、`decorator`、`decoratorProps`
- 动态协议字段：`x-reaction`、`x-format`、`x-validate`

## 基础类型

支持的字段类型：

- `string`
- `number`
- `boolean`
- `object`
- `array`
- `void`
- `date`
- `datetime`

## 标准字段

| 字段                      | 说明                                         |
| ------------------------- | -------------------------------------------- |
| `type`                    | 字段类型                                     |
| `title`                   | 标题                                         |
| `description`             | 描述                                         |
| `default`                 | 默认值                                       |
| `required`                | 是否必填                                     |
| `minimum` / `maximum`     | 数值范围                                     |
| `minLength` / `maxLength` | 字符串长度范围                               |
| `pattern`                 | 正则规则                                     |
| `format`                  | 格式规则                                     |
| `properties`              | 对象子属性                                   |
| `items`                   | 数组项定义                                   |
| `definitions`             | 根级可复用定义，仅允许出现在根 `IFormSchema` |
| `$ref`                    | 本地 definitions 引用                        |

## 运行时扩展字段

| 字段               | 说明                     |
| ------------------ | ------------------------ |
| `state`            | 初始显示态与交互态       |
| `validators`       | 静态校验规则             |
| `component`        | 组件注册键名             |
| `props`            | 组件 props               |
| `decorator`        | 包装器注册键名           |
| `decoratorProps`   | 包装器 props             |
| `dataSource`       | 选项列表                 |
| `dataSourcePolicy` | 数据源变化时的值处理策略 |
| `x-reaction`       | 字段属性联动             |
| `x-format`         | 输入态 / 输出态值转换    |
| `x-validate`       | 动态校验规则             |
| `content`          | 布局型节点内容           |
| `data`             | 自定义附加数据           |

## 节点行为

### object

- 有 `component`：创建字段实例，并继续递归子属性
- 无 `component`：只作为结构容器，不创建独立字段

### void

- 作为布局节点存在
- 不参与 `form.values`
- 可以携带组件、标题、描述、布局 props

### array

- `items` 为对象结构时，会创建数组字段及每行子字段
- 否则表现为简单数组字段

## definitions / $ref

### 支持范围

当前实现只支持：

```json
{ "$ref": "#/definitions/Name" }
```

并且 `definitions` 只能定义在根 `IFormSchema` 上，不能定义在任意字段节点里。

不支持：

- 远程引用
- 任意 JSON Pointer
- 非根级 definitions 路径

### 合并规则

`$ref` 展开后，本地节点属性覆盖引用目标属性。

## state

`state` 只保留两个主入口：

- `display`: `visible | hidden | none`
- `pattern`: `editable | readOnly | disabled | readPretty`

## dataSource

`dataSource` 会被标准化为统一选项结构，是当前 schema 协议里唯一的选项源入口。

## dataSourcePolicy

支持的策略：

- `preserve`
- `clear`
- `filter`
- `first`

用于处理数据源变化后当前值是否保留。

## x-reaction

真实结构如下：

```json
{
  "x-reaction": {
    "display": {
      "type": "match",
      "dependencies": {
        "kind": "kind"
      },
      "match": {
        "email": "visible",
        "default": "none"
      }
    }
  }
}
```

### 支持的规则类型

- `static`
- `expression`
- `match`
- `computed`

### 支持的目标属性

- `value`
- `display`
- `visible`
- `hidden`
- `pattern`
- `disabled`
- `readOnly`
- `readPretty`
- `editable`
- `required`
- `title`
- `description`
- `props`
- `decoratorProps`
- `component`
- `decorator`
- `dataSource`

## x-format

结构固定为：

```json
{
  "x-format": {
    "input": { ...rule },
    "output": { ...rule }
  }
}
```

### 真实时机

- `input`：字段创建、`form.setValues()`
- `output`：读取 `form.values`、`form.submit()`

### 注意

`x-format.input` 不会在用户每次输入时自动执行。

## x-validate

`x-validate` 是单条规则或规则数组：

```json
{
  "x-validate": {
    "type": "expression",
    "expression": "$value ? undefined : '必填'"
  }
}
```

### 执行顺序

字段校验顺序：

1. `display === 'none'` 则跳过
2. `required`
3. `validators`
4. `x-validate`

## form.values 边界

`form.values` 是经过运行时过滤和输出格式化后的结果，不是原始值快照。

会排除：

- `display === 'none'` 的字段
- `void` 节点
- 数组子字段路径

并在输出前应用 `x-format.output`。

## 建议阅读顺序

如果你要真正理解 Schema 的运行方式，建议继续阅读：

- [Schema 协议](/guide/schema-protocol)
- [x-reaction](/guide/advanced/x-reaction)
- [x-format](/guide/advanced/x-format)
- [x-validate](/guide/advanced/x-validate)
