# Field

## 描述

这一页描述的是 `form.getField(path)` 返回的 `IField` 运行时对象。

在当前范式里，业务代码应把 `IField` 视为稳定的公开契约，而不是依赖某个 `Field` class 的具体实现细节。

## 核心属性

| 属性名 | 描述 |
| --- | --- |
| `path` | 字段路径 |
| `address` | 当前字段的运行时地址 |
| `title` | 字段标题 |
| `description` | 字段描述 |
| `value` | 当前值 |
| `initialValue` | 初始值基线 |
| `display` | 显示状态，值为 `visible`、`hidden`、`none` |
| `pattern` | 交互模式，值为 `editable`、`readOnly`、`disabled`、`readPretty` |
| `visible` | `display === "visible"` 的便捷布尔值 |
| `hidden` | `display === "hidden"` 的便捷布尔值 |
| `disabled` | 是否禁用 |
| `readOnly` | 是否只读 |
| `readPretty` | 是否为纯展示态 |
| `editable` | 是否可编辑 |
| `required` | 是否必填 |
| `errors` | 错误列表 |
| `warnings` | 警告列表 |
| `validateStatus` | 当前校验状态 |
| `component` | 组件注册 key |
| `componentProps` | 组件 props |
| `decorator` | 装饰器注册 key |
| `decoratorProps` | 装饰器 props |
| `dataSource` | 规范化后的选项列表 |
| `loading` | 当前字段是否处于异步 loading 中 |
| `data` | 字段私有数据槽 |
| `content` | 字段内容槽 |

## 核心方法

| 方法名 | 描述 |
| --- | --- |
| `setValue(value)` | 更新字段值 |
| `setErrors(errors)` | 直接写入错误列表 |
| `setWarnings(warnings)` | 直接写入警告列表 |
| `validate()` | 执行字段校验，返回 `FieldError[]` |
| `reset()` | 恢复到初始值 |
| `setState(state)` | 批量更新字段状态 |
| `setDataSource(ds)` | 更新选项数据源 |
| `setLoading(loading)` | 设置 loading 状态 |
| `setDisplay(display)` | 更新显示状态 |
| `setPattern(pattern)` | 更新交互模式 |
| `setComponent(component, props?)` | 更新组件及其 props |
| `setDecorator(decorator, props?)` | 更新装饰器及其 props |
| `subscribe(listener)` | 订阅字段级更新 |
| `effect(runner)` | 注册字段级响应式副作用 |

## 数组字段能力

当字段是数组字段时，还会暴露以下能力：

- `isArrayField`
- `arrayItems`
- `push(initialValues?)`
- `remove(index)`
- `moveUp(index)`
- `moveDown(index)`

这里的 `arrayItems` 是二维字段数组，每一行对应一组真实子字段实例。

## `field.effect` 与 `form.effect` 的区别

- `field.effect(runner)`：适合观察单个字段自己的局部状态
- `form.effect(selector, listener)`：适合跨字段、跨值树的表单级联动

如果规则本质上是在协调多个字段，通常应优先放到 `createForm({ setup }) + form.effect(...)`，而不是把复杂逻辑拆散到多个字段局部 effect 中。

## 注意事项

- `IField` 是运行时对象，不是静态 schema 节点。
- `display: "none"` 的字段不会进入 `form.values`，也不会参与校验。
- `display: "hidden"` 的字段仍保留值和校验，只是不显示。
- 当你需要命令式修正字段状态时，优先通过 `form.setFieldState(path, setter)` 或当前字段实例方法完成。
