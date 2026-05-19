# Form

## 描述

`Form` 是 `@alien-form/core` 中最顶层的运行时模型。它拥有字段注册表、Schema 设置、表单值、提交状态、校验入口以及订阅机制。

## 创建方式

```ts
import { createForm } from '@alien-form/core'

const form = createForm()
```

## 核心属性

| 属性名 | 类型 | 描述 |
| --- | --- | --- |
| `fields` | `Map<string, IField>` | 已注册的字段实例集合 |
| `values` | `Record<string, any>` | 经过可见性过滤和 `x-format.output` 格式化后的输出值 |
| `initialValues` | `Record<string, any>` | 初始值快照 |
| `valid` | `boolean` | 当前可见字段是否全部校验通过 |
| `invalid` | `boolean` | `valid` 的反义值 |
| `submitting` | `boolean` | 当前是否处于提交状态 |
| `errors` | `FieldError[]` | 扁平化的可见字段错误列表 |

## 核心方法

| 方法名 | 描述 |
| --- | --- |
| `setSchema(schema)` | 根据 schema 重建字段注册表和联动规则 |
| `getField(path)` | 根据路径获取字段实例 |
| `setInitialValues(values)` | 更新表单的初始值快照，供 `reset()` 使用 |
| `setValues(values)` | 将值批量写入现有的字段中 |
| `validate()` | 校验所有可见字段 |
| `submit(onSubmit?)` | 校验表单并返回输出值 |
| `reset()` | 将所有字段重置为其初始值 |
| `subscribe(listener)` | 订阅表单级别的更新 |
| `onValuesChange(listener)` | 订阅输出值的变更 |
| `onError(listener)` | 订阅非致命的运行时错误 |

## 注意事项

- `setSchema()` 在重建之前会清除旧的字段和联动规则。
- `setInitialValues()` 只更新初始值基线，不会自动改写当前字段值；编辑态回填通常需要与 `setValues()` 配合使用。
- `values` 是一个派生状态，而不是一个可变的内部状态容器。
- 当校验失败时，`submit()` 会抛出异常，并将错误信息字符串附加到抛出的错误对象上。
