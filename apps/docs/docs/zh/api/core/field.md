# Field

## 描述

`Field` 是 AlienForm 中最小的响应式状态单元。每个字段对应一个路径，并存储了该字段的值、显示状态、交互模式、校验结果以及组件的元数据。

## 核心属性

| 属性名           | 描述                                                              |
| ---------------- | ----------------------------------------------------------------- |
| `path`           | 字段的点分隔路径（dot-path）                                      |
| `value`          | 当前值                                                            |
| `display`        | 显示状态，值为 `visible`、`hidden` 或 `none`                      |
| `pattern`        | 交互模式，值为 `editable`、`readOnly`、`disabled` 或 `readPretty` |
| `component`      | 注册的组件标识符（key）                                           |
| `componentProps` | 传递给组件的 props 集合                                           |
| `decorator`      | 注册的包装器标识符（key）                                         |
| `dataSource`     | 规范化后的选项列表数据源                                          |
| `errors`         | 校验错误信息                                                      |
| `validateStatus` | 字段的校验状态                                                    |

## 核心方法

| 方法名                | 描述                     |
| --------------------- | ------------------------ |
| `setValue(value)`     | 更新字段的值             |
| `setState(partial)`   | 批量更新字段状态         |
| `validate()`          | 执行静态和动态的校验规则 |
| `reset()`             | 恢复为初始值             |
| `subscribe(listener)` | 订阅字段级别的更新       |

## 数组方法

当该字段是一个数组字段时，它还会暴露出以下方法：

- `push(initialValues?)`
- `remove(index)`
- `moveUp(index)`
- `moveDown(index)`
- `arrayItems`
