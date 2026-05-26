# UI 组件概览

## 描述

`@alien-form/ui` 提供一组默认 UI 组件实现，主要用于演示应用、快速集成和 schema 驱动渲染示例。

## 导出分组

- 文本输入：`Input`, `Textarea`, `ItemInput`
- 选择输入：`Select`, `RadioGroup`, `Checkbox`, `Switch`, `Rating`, `DateInput`
- 包装器与布局：`FormItem`, `FormGrid`, `FormLayout`, `FormSection`
- 数组组件：`ArrayCards`, `ArrayTable`
- 基础组件：`Button`, `Card`, `Tabs`, `ScrollArea`

## 集成规则

对渲染器来说，`@alien-form/ui` 没有任何特殊权限。它之所以能工作，是因为：

- 注册键名与 schema 中的 `component` / `decorator` 值匹配
- 组件能够消费 React 渲染器提供的标准化字段属性

## 使用边界

- `@alien-form/ui` 是默认实现，不定义协议边界
- `@alien-form/core` 和 `@alien-form/react` 才负责 form runtime 与渲染协议
- 你可以替换这些组件，只要继续遵守字段与装饰器契约

## 注意事项

- 如果你的团队已有自己的设计系统，通常只需要保留协议层，替换默认 UI 组件即可
- 非标准属性应由 UI 适配层自行拦截和处理，不应反向污染 core runtime
