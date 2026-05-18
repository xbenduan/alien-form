# 快速开始

## 安装

```bash
npm install @formily-bao/core @formily-bao/react @formily-bao/ui
```

## 基本示例

```tsx
import { createForm } from '@formily-bao/core'
import { FormProvider, SchemaField } from '@formily-bao/react'
import { Input, Select, FormItem } from '@formily-bao/ui'

const form = createForm({
  initialValues: { role: 'developer' },
})

const schema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      title: '用户名',
      required: true,
      'component': 'Input',
      'decorator': 'FormItem',
      'validators': [{ minLength: 3, message: '至少 3 个字符' }],
    },
    role: {
      type: 'string',
      title: '角色',
      'component': 'Select',
      'decorator': 'FormItem',
      enum: [
        { label: '开发者', value: 'developer' },
        { label: '设计师', value: 'designer' },
      ],
    },
  },
}

function App() {
  return (
    <FormProvider form={form} components={{ Input, Select }} decorators={{ FormItem }}>
      <SchemaField schema={schema} />
      <button onClick={() => form.submit(console.log)}>提交</button>
    </FormProvider>
  )
}
```

## 工作原理

1. **`createForm()`** 创建由 Alien Signals 支持的响应式表单实例
2. **`FormProvider`** 建立 React Context，注册组件和装饰器
3. **`SchemaField`** 内部调用 `form.setSchema()`，为每个属性创建 `Field` 实例并设置 `reactions` 效果
4. 每个 `Field` 将状态存储在 signal 中（`_value`、`_display`、`_pattern`、`_errors` 等）— 仅订阅的组件会重新渲染

## 架构

```
JSON Schema (Formily 协议)
        │
        ▼
┌─────────────────────────────┐
│        Form (form.ts)       │
│  • createField()            │
│  • setSchema() — 解析 $ref、│
│    order、创建字段、       │
│    设置 reactions            │
│  • 表达式引擎               │
│  • 生命周期注册             │
└──────────────┬──────────────┘
               │ 创建
               ▼
┌─────────────────────────────┐
│       Field (field.ts)      │
│  • Alien Signals 状态       │
│  • validate() + 格式验证    │
│  • 数组操作                 │
│  • setState() / display /   │
│    pattern 控制             │
└──────────────┬──────────────┘
               │ 消费
               ▼
┌─────────────────────────────┐
│    React 层 (react.tsx)     │
│  • FormProvider / SchemaField│
│  • useForm / useField       │
│  • FieldRenderer            │
│  • ArrayFieldRenderer       │
└─────────────────────────────┘
```

## 包

| 包名 | 说明 |
|------|------|
| `@formily-bao/core` | 无头表单模型、字段状态、表达式引擎 |
| `@formily-bao/ui` | UI 组件：Input、Select、Switch、Rating、ArrayCards、FormGrid 等 |
