# UI 组件概览 (UI Overview)

## 描述

`@alien-form/ui` 提供了一系列可选的 UI 组件，供演示应用以及 Schema 驱动的组件注册示例使用。

## 导出分组

- 文本输入：`Input`, `Textarea`, `ItemInput`
- 选择输入：`Select`, `RadioGroup`, `Checkbox`, `Switch`, `Rating`, `DateInput`
- 包装器与布局：`FormItem`, `FormGrid`, `FormLayout`, `FormSection`
- 数组组件：`ArrayCards`, `ArrayTable`
- 基础原件：`Button`, `Card`, `Tabs`, `ScrollArea`

## 集成规则

UI 包对渲染器来说并没有特殊之处。这些组件能够正常工作，是因为它们在注册时的键名与 Schema 中的 `component` 和 `decorator` 的值相匹配，并且它们能够消费由 React 渲染器提供的标准化字段属性 (props)。
